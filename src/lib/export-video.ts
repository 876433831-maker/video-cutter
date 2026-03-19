import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import type {
  EditSegment,
  ExportMode,
  SubtitleFontSize
} from "@/lib/video-edit-types";

const execFileAsync = promisify(execFile);

const EXPORT_PRESETS = {
  fast: {
    intermediatePreset: "faster",
    intermediateCrf: "18"
  },
  final: {
    intermediatePreset: "fast",
    intermediateCrf: "17",
    outputPreset: "fast",
    outputCrf: "18"
  }
} as const;

type ExportProgressPayload = {
  percent: number;
  stage: string;
};

type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

type VideoMetadata = {
  width: number;
  height: number;
};

function sanitizeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();

  return extension && extension.length <= 10 ? extension : ".mp4";
}

function mergeAdjacentKeptSegments(segments: EditSegment[]) {
  return segments
    .filter((segment) => segment.action === "keep")
    .sort((left, right) => left.start - right.start)
    .reduce<EditSegment[]>((merged, segment) => {
      const previous = merged[merged.length - 1];

      if (
        previous &&
        previous.reason !== "pause" &&
        segment.reason !== "pause" &&
        previous.groupId === segment.groupId &&
        Math.abs(previous.end - segment.start) < 0.001 &&
        previous.speed === segment.speed &&
        previous.volumeGainDb === segment.volumeGainDb
      ) {
        previous.end = segment.end;
        previous.text += segment.text;
        return merged;
      }

      merged.push({ ...segment });
      return merged;
    }, []);
}

function calculateOutputDuration(segments: EditSegment[]) {
  return mergeAdjacentKeptSegments(segments).reduce(
    (total, segment) =>
      total + (segment.end - segment.start) / Math.max(segment.speed, 0.1),
    0
  );
}

function buildFilterGraph(segments: EditSegment[]) {
  const keptSegments = mergeAdjacentKeptSegments(segments);

  if (keptSegments.length === 0) {
    throw new Error("没有可导出的片段。请至少保留一段字幕内容。");
  }

  const filters: string[] = [];
  const concatInputs: string[] = [];

  keptSegments.forEach((segment, index) => {
    const speed = segment.speed > 0 ? segment.speed : 1;
    const volumeGain = Number.isFinite(segment.volumeGainDb)
      ? segment.volumeGainDb
      : 0;

    filters.push(
      `[0:v]trim=start=${segment.start}:end=${segment.end},setpts=(PTS-STARTPTS)/${speed}[v${index}]`
    );
    filters.push(
      `[0:a]atrim=start=${segment.start}:end=${segment.end},asetpts=PTS-STARTPTS,atempo=${speed},volume=${volumeGain}dB[a${index}]`
    );

    concatInputs.push(`[v${index}]`, `[a${index}]`);
  });

  filters.push(
    `${concatInputs.join("")}concat=n=${keptSegments.length}:v=1:a=1[outv][outa]`
  );

  return filters.join(";");
}

function formatSrtTimestamp(seconds: number) {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

function escapeSrtText(text: string) {
  return text.replace(/\r\n/g, "\n").trim();
}

function wrapSubtitleText(text: string, fontSize: number, maxWidth: number) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n/g, " ");
  const maxCharsPerLine = Math.min(
    15,
    Math.max(6, Math.floor(maxWidth / Math.max(fontSize * 1.15, 1)))
  );
  const lines: string[] = [];
  let currentLine = "";

  Array.from(normalized).forEach((character) => {
    if ((currentLine + character).length > maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = character;
      return;
    }

    currentLine += character;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 3);
}

function buildSubtitleCues(segments: EditSegment[]) {
  const keptSegments = mergeAdjacentKeptSegments(segments).filter(
    (segment) =>
      segment.action === "keep" &&
      segment.text.trim() &&
      segment.reason !== "pause"
  );

  let currentTime = 0;
  const cues: SubtitleCue[] = [];

  keptSegments.forEach((segment) => {
    const duration = (segment.end - segment.start) / (segment.speed || 1);
    const text = escapeSrtText(segment.text);

    if (!text || duration <= 0) {
      currentTime += Math.max(duration, 0);
      return;
    }

    cues.push({
      start: currentTime,
      end: currentTime + duration,
      text
    });

    currentTime += duration;
  });

  return cues;
}

async function probeVideoSize(filePath: string) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    filePath
  ]);

  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ width?: number; height?: number }>;
  };
  const stream = parsed.streams?.[0];

  if (!stream?.width || !stream?.height) {
    throw new Error("无法读取导出视频尺寸。");
  }

  return {
    width: stream.width,
    height: stream.height
  } satisfies VideoMetadata;
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function renderSubtitleImage(params: {
  cue: SubtitleCue;
  index: number;
  tempDir: string;
  videoSize: VideoMetadata;
  subtitleFontSize: SubtitleFontSize;
}) {
  const { cue, index, tempDir, videoSize, subtitleFontSize } = params;
  const maxTextWidth = Math.floor(videoSize.width * 0.78);
  const safeFontSize = Math.max(8, subtitleFontSize * 4);
  const lines = wrapSubtitleText(cue.text, safeFontSize, maxTextWidth);
  const lineHeight = Math.round(safeFontSize * 1.45);
  const horizontalPadding = Math.round(safeFontSize * 0.75);
  const verticalPadding = Math.round(safeFontSize * 0.45);
  const textWidths = lines.map((line) =>
    Math.round(Array.from(line).length * safeFontSize * 1.05)
  );
  const boxWidth = Math.min(
    videoSize.width - 48,
    Math.max(...textWidths, safeFontSize * 4) + horizontalPadding * 2
  );
  const boxHeight = lines.length * lineHeight + verticalPadding * 2;
  const textY = verticalPadding + safeFontSize;
  const imagePath = join(tempDir, `subtitle-${index + 1}.png`);
  const tspanMarkup = lines
    .map((line, lineIndex) => {
      const dy = lineIndex === 0 ? 0 : lineHeight;
      return `<tspan x="50%" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  const svg = `
    <svg width="${boxWidth}" height="${boxHeight}" viewBox="0 0 ${boxWidth} ${boxHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${boxWidth}" height="${boxHeight}" rx="${Math.round(safeFontSize * 0.5)}" fill="rgba(0,0,0,0.86)" />
      <text
        x="50%"
        y="${textY}"
        fill="#FFFFFF"
        font-size="${safeFontSize}"
        font-family="Arial, PingFang SC, Microsoft YaHei, sans-serif"
        text-anchor="middle"
      >${tspanMarkup}</text>
    </svg>
  `.trim();

  await sharp(Buffer.from(svg)).png().toFile(imagePath);

  return imagePath;
}

async function renderSubtitleImages(params: {
  cues: SubtitleCue[];
  tempDir: string;
  videoSize: VideoMetadata;
  subtitleFontSize: SubtitleFontSize;
  onProgress?: (progress: number) => void;
}) {
  const { cues, tempDir, videoSize, subtitleFontSize, onProgress } = params;
  const imagePaths: string[] = [];

  for (let index = 0; index < cues.length; index += 1) {
    const imagePath = await renderSubtitleImage({
      cue: cues[index],
      index,
      tempDir,
      videoSize,
      subtitleFontSize
    });

    imagePaths.push(imagePath);
    onProgress?.((index + 1) / cues.length);
  }

  return imagePaths;
}

function buildOverlayFilterGraph(cues: SubtitleCue[]) {
  if (cues.length === 0) {
    return null;
  }

  const filters = ["[0:v]format=yuv420p[v0]"];

  cues.forEach((cue, index) => {
    const inputLabel = `[${index + 1}:v]`;
    const prevLabel = `[v${index}]`;
    const nextLabel = `[v${index + 1}]`;
    const start = cue.start.toFixed(3);
    const end = cue.end.toFixed(3);

    filters.push(
      `${prevLabel}${inputLabel}overlay=x=(main_w-overlay_w)/2:y=main_h-overlay_h-72:enable=between(t\\,${start}\\,${end})${nextLabel}`
    );
  });

  return {
    filterGraph: filters.join(";"),
    outputLabel: `[v${cues.length}]`
  };
}

async function runFfmpegWithProgress(params: {
  args: string[];
  durationSeconds: number;
  onProgress?: (progress: number) => void;
}) {
  const { args, durationSeconds, onProgress } = params;
  const safeDuration = Math.max(durationSeconds, 0.1);

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ["-progress", "pipe:1", "-nostats", ...args]);
    let stdoutBuffer = "";
    let stderr = "";
    let lastProgress = 0;

    ffmpeg.stdout.on("data", (chunk: Buffer | string) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const [key, value] = line.split("=");

        if (key === "out_time_ms" && value) {
          const outTimeMs = Number(value);

          if (Number.isFinite(outTimeMs)) {
            const nextProgress = Math.max(
              lastProgress,
              Math.min(outTimeMs / (safeDuration * 1_000_000), 1)
            );
            lastProgress = nextProgress;
            onProgress?.(nextProgress);
          }
        }

        if (key === "progress" && value === "end") {
          onProgress?.(1);
        }
      }
    });

    ffmpeg.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `ffmpeg 执行失败，退出码 ${code}`));
    });
  });
}

export async function exportEditedVideo(params: {
  file: File;
  segments: EditSegment[];
  subtitleFontSize: SubtitleFontSize;
  exportMode: ExportMode;
  onProgress?: (progress: ExportProgressPayload) => void;
}) {
  const { file, segments, subtitleFontSize, exportMode, onProgress } = params;
  const tempDir = await mkdtemp(join(tmpdir(), "video-cutter-"));
  const inputPath = join(tempDir, `input${sanitizeExtension(file.name)}`);
  const intermediatePath = join(tempDir, "intermediate.mp4");
  const outputPath = join(tempDir, "output.mp4");
  const totalOutputSeconds = calculateOutputDuration(segments);

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, bytes);
    onProgress?.({ percent: 4, stage: "正在读取素材" });

    const filterGraph = buildFilterGraph(segments);

    await runFfmpegWithProgress({
      args: [
        "-y",
        "-i",
        inputPath,
        "-filter_complex",
        filterGraph,
        "-map",
        "[outv]",
        "-map",
        "[outa]",
        "-c:v",
        "libx264",
        "-preset",
        EXPORT_PRESETS[exportMode].intermediatePreset,
        "-crf",
        EXPORT_PRESETS[exportMode].intermediateCrf,
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "high",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        intermediatePath
      ],
      durationSeconds: totalOutputSeconds,
      onProgress: (progress) => {
        const mappedProgress = exportMode === "final" ? 8 + progress * 58 : 8 + progress * 74;
        onProgress?.({
          percent: mappedProgress,
          stage: "正在拼接片段"
        });
      }
    });

    const subtitleCues = buildSubtitleCues(segments);

    if (subtitleCues.length > 0 && exportMode === "final") {
      const videoSize = await probeVideoSize(intermediatePath);
      onProgress?.({ percent: 68, stage: "正在渲染字幕" });
      const imagePaths = await renderSubtitleImages({
        cues: subtitleCues,
        tempDir,
        videoSize,
        subtitleFontSize,
        onProgress: (progress) => {
          onProgress?.({
            percent: 68 + progress * 12,
            stage: "正在渲染字幕"
          });
        }
      });
      const overlay = buildOverlayFilterGraph(subtitleCues);

      if (!overlay) {
        throw new Error("字幕图片生成失败，暂时不能导出。");
      }

      await runFfmpegWithProgress({
        args: [
          "-y",
          "-i",
          intermediatePath,
          ...imagePaths.flatMap((imagePath) => ["-loop", "1", "-i", imagePath]),
          "-filter_complex",
          overlay.filterGraph,
          "-map",
          overlay.outputLabel,
          "-map",
          "0:a:0",
          "-c:v",
          "libx264",
          "-preset",
          EXPORT_PRESETS.final.outputPreset,
          "-crf",
          EXPORT_PRESETS.final.outputCrf,
          "-pix_fmt",
          "yuv420p",
          "-profile:v",
          "high",
          "-c:a",
          "copy",
          "-movflags",
          "+faststart",
          outputPath
        ],
        durationSeconds: totalOutputSeconds,
        onProgress: (progress) => {
          onProgress?.({
            percent: 80 + progress * 19,
            stage: "正在压制硬字幕"
          });
        }
      });
    } else if (subtitleCues.length > 0) {
      const srtPath = join(tempDir, "subtitles.srt");
      const srtContent = subtitleCues
        .map(
          (cue, index) =>
            `${index + 1}\n${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}\n${cue.text}`
        )
        .join("\n\n");

      await writeFile(srtPath, srtContent, "utf8");
      onProgress?.({ percent: 86, stage: "正在封装字幕轨" });

      await execFileAsync("ffmpeg", [
        "-y",
        "-i",
        intermediatePath,
        "-i",
        srtPath,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        "-map",
        "1:0",
        "-c:v",
        "copy",
        "-c:a",
        "copy",
        "-c:s",
        "mov_text",
        "-metadata:s:s:0",
        "language=zho",
        "-movflags",
        "+faststart",
        outputPath
      ]);
    } else {
      onProgress?.({ percent: 92, stage: "正在封装视频" });
      await execFileAsync("ffmpeg", ["-y", "-i", intermediatePath, "-c", "copy", outputPath]);
    }

    onProgress?.({ percent: 100, stage: "导出完成" });
    return readFile(outputPath);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new Error("系统里还没有安装 ffmpeg，所以暂时不能导出真实视频。");
    }

    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
