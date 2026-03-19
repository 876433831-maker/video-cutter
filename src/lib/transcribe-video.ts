import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import type {
  EditReason,
  EditSegment,
  TranscriptGenerationResult,
  TranscriptSegment
} from "@/lib/video-edit-types";
import {
  analyzeTranscriptSegments,
  isFillerLikeText,
  normalizeText
} from "./transcript-analysis";

const execFileAsync = promisify(execFile);
const VOLCENGINE_RESOURCE_ID = "volc.bigasr.auc_turbo";

function sanitizeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  return extension && extension.length <= 10 ? extension : ".mp4";
}

async function probeDuration(filePath: string) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath
    ]);

    const value = Number(stdout.trim());
    return Number.isFinite(value) && value > 0 ? value : 90;
  } catch {
    return 90;
  }
}

async function extractAudioFile(inputPath: string, tempDir: string) {
  const audioPath = join(tempDir, "audio.mp3");

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "64k",
    audioPath
  ]);

  return audioPath;
}

function makeId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`;
}

function classifyReason(text: string): EditReason {
  if (isFillerLikeText(text)) {
    return "filler";
  }

  const normalized = normalizeText(text);

  if (!normalized) {
    return "noise";
  }

  return "content";
}

function splitEditableTextSegment(params: {
  segment: TranscriptSegment;
  action: EditSegment["action"];
  reason: EditReason;
}) {
  const { segment, action, reason } = params;

  if (segment.words && segment.words.length > 0) {
    const words = segment.words
      .filter((word) => word.text.length > 0)
      .flatMap((word) => {
        const chars = Array.from(word.text);
        const duration = Math.max(word.end - word.start, 0.05);
        const unitDuration = duration / Math.max(chars.length, 1);

        return chars.map((character, index) => ({
          character,
          start: word.start + unitDuration * index,
          end: word.start + unitDuration * (index + 1)
        }));
      });

    return words.map((word, index) => ({
      id: `${segment.id}-char-${index + 1}`,
      groupId: `edit-${segment.id}`,
      unitIndex: index,
      unitCount: words.length,
      start: word.start,
      end: word.end,
      text: word.character,
      originalText: word.character,
      action,
      suggestedAction: action === "remove" ? "remove" : "keep",
      reason,
      speed: 1.5,
      volumeGainDb: 3
    })) satisfies EditSegment[];
  }

  const chars = Array.from(segment.text);
  const duration = Math.max(segment.end - segment.start, 0.1);
  const unitDuration = duration / Math.max(chars.length, 1);

  return chars.map((character, index) => ({
    id: `${segment.id}-char-${index + 1}`,
    groupId: `edit-${segment.id}`,
    unitIndex: index,
    unitCount: chars.length,
    start: segment.start + unitDuration * index,
    end: segment.start + unitDuration * (index + 1),
    text: character,
    originalText: character,
    action,
    suggestedAction: action === "remove" ? "remove" : "keep",
    reason,
    speed: 1.5,
    volumeGainDb: 3
  })) satisfies EditSegment[];
}

function buildMockTranscript(duration: number) {
  const contentPool = [
    "大家早上好，今天聊三个做内容的关键动作。",
    "第一，先抓住观众最关心的问题。",
    "第二，表达尽量直接，不要绕。",
    "第三，给一个马上能执行的小结论。",
    "如果你也想把口播剪得更干净，这个流程就够用了。"
  ];

  const transcriptSegments: TranscriptSegment[] = [];
  let cursor = 0;
  let contentIndex = 0;

  while (cursor < duration - 2) {
    const pauseLength = 0.35 + (contentIndex % 3) * 0.18;
    transcriptSegments.push({
      id: makeId("pause", transcriptSegments.length),
      start: cursor,
      end: Math.min(cursor + pauseLength, duration),
      text: "停顿"
    });
    cursor += pauseLength;

    const contentText = contentPool[contentIndex % contentPool.length];
    const contentDuration = Math.min(
      4.5 + (contentIndex % 2) * 1.2,
      Math.max(duration - cursor - 0.4, 1.5)
    );

    transcriptSegments.push({
      id: makeId("content", transcriptSegments.length),
      start: cursor,
      end: cursor + contentDuration,
      text: contentText
    });
    cursor += contentDuration;

    if (cursor < duration - 1) {
      const fillerLength = 0.28 + (contentIndex % 2) * 0.08;
      const fillerText = contentIndex % 2 === 0 ? "嗯" : "额";
      transcriptSegments.push({
        id: makeId("filler", transcriptSegments.length),
        start: cursor,
        end: Math.min(cursor + fillerLength, duration),
        text: fillerText
      });
      cursor += fillerLength;
    }

    contentIndex += 1;
  }

  return transcriptSegments;
}

type VolcengineUtterance = {
  text?: string;
  start_time?: number;
  end_time?: number;
  confidence?: number;
  words?: Array<{
    text?: string;
    start_time?: number;
    end_time?: number;
    confidence?: number;
  }>;
};

async function transcribeWithVolcengine(audioPath: string) {
  const appKey = process.env.VOLCENGINE_APP_KEY;
  const accessKey = process.env.VOLCENGINE_ACCESS_KEY;

  if (!appKey || !accessKey) {
    return null;
  }

  try {
    const audioBuffer = await readFile(audioPath);
    const response = await fetch(
      "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-App-Key": appKey,
          "X-Api-Access-Key": accessKey,
          "X-Api-Resource-Id": VOLCENGINE_RESOURCE_ID,
          "X-Api-Request-Id": randomUUID(),
          "X-Api-Sequence": "-1"
        },
        body: JSON.stringify({
          user: {
            uid: "video-cutter"
          },
          audio: {
            format: "mp3",
            data: audioBuffer.toString("base64")
          },
          request: {
            enable_itn: true,
            enable_punc: true
          }
        })
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      result?: {
        utterances?: VolcengineUtterance[];
      };
    };

    const utterances = payload.result?.utterances ?? [];

    if (utterances.length === 0) {
      return null;
    }

    const transcriptSegments: TranscriptSegment[] = utterances.map((utterance, index) => ({
      id: makeId("content", index),
      start: (utterance.start_time ?? 0) / 1000,
      end: (utterance.end_time ?? 0) / 1000,
      text: utterance.text?.trim() || "",
      confidence: utterance.confidence,
      words:
        utterance.words?.map((word) => ({
          text: word.text ?? "",
          start: (word.start_time ?? 0) / 1000,
          end: (word.end_time ?? 0) / 1000,
          confidence: word.confidence
        })) ?? []
    }));

    return transcriptSegments.filter(
      (segment) => segment.text.trim().length > 0 && segment.end > segment.start
    );
  } catch {
    return null;
  }
}

function addPauseSegments(segments: TranscriptSegment[], totalDuration: number) {
  const results: TranscriptSegment[] = [];
  let cursor = 0;
  let pauseIndex = 0;

  segments
    .sort((left, right) => left.start - right.start)
    .forEach((segment) => {
      const gap = segment.start - cursor;

      if (gap >= 0.28) {
        results.push({
          id: `pause-${pauseIndex + 1}`,
          start: cursor,
          end: segment.start,
          text: "停顿"
        });
        pauseIndex += 1;
      }

      results.push(segment);
      cursor = Math.max(cursor, segment.end);
    });

  if (totalDuration - cursor >= 0.4) {
    results.push({
      id: `pause-${pauseIndex + 1}`,
      start: cursor,
      end: totalDuration,
      text: "停顿"
    });
  }

  return results;
}

export async function transcribeVideo(file: File): Promise<TranscriptGenerationResult> {
  const tempDir = await mkdtemp(join(tmpdir(), "video-cutter-transcribe-"));
  const inputPath = join(tempDir, `input${sanitizeExtension(file.name)}`);

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, bytes);
    const duration = await probeDuration(inputPath);
    const audioPath = await extractAudioFile(inputPath, tempDir);
    const cloudTranscript = await transcribeWithVolcengine(audioPath);
    const transcriptSegments = cloudTranscript
      ? addPauseSegments(cloudTranscript, duration)
      : buildMockTranscript(duration);
    const analysis = await analyzeTranscriptSegments(
      transcriptSegments.filter((segment) => segment.text !== "停顿")
    );

    const editSegments: EditSegment[] = transcriptSegments.flatMap((segment) => {
      if (segment.text === "停顿") {
        return [
          {
            id: `pause-edit-${segment.id}`,
            groupId: `pause-${segment.id}`,
            unitIndex: 0,
            unitCount: 1,
            start: segment.start,
            end: segment.end,
            text: "停顿",
            originalText: "停顿",
            action: "remove",
            suggestedAction: "remove",
            reason: "pause",
            speed: 1,
            volumeGainDb: 0
          } satisfies EditSegment
        ];
      }

      const fallbackReason = classifyReason(segment.text);
      const decision = analysis[segment.id];
      const reason = decision?.reason ?? fallbackReason;
      const action: EditSegment["action"] =
        decision?.action ?? (reason === "filler" ? "remove" : "keep");

      return splitEditableTextSegment({
        segment,
        action,
        reason
      });
    });

    return {
      transcriptSegments,
      editSegments
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
