import type { EditReason, TranscriptSegment } from "@/lib/video-edit-types";

const fillerTokens = new Set([
  "n",
  "e",
  "o",
  "en",
  "em",
  "uh",
  "um",
  "er",
  "ah",
  "oh",
  "嗯",
  "呃",
  "额",
  "哦",
  "噢",
  "诶",
  "欸",
  "啊"
]);
const punctuationTokens = new Set(["，", "。", "、", "！", "？", ",", ".", "!", "?", "；", ";", "：", ":", " "]);
const stutterSingleChars = new Set([
  "我",
  "你",
  "他",
  "她",
  "它",
  "这",
  "那",
  "就",
  "又",
  "也",
  "会",
  "要",
  "是",
  "在",
  "有",
  "跟",
  "把",
  "给",
  "先",
  "再",
  "还"
]);
const standaloneRedundantTokens = new Set([
  "然后",
  "那么",
  "那就是",
  "就是说",
  "也就是说",
  "其实",
  "其实就是",
  "这个呢",
  "那个呢",
  "你知道吗",
  "你知道吧"
]);
const redundantStarterPatterns = [
  "今天想跟大家聊一下",
  "今天想跟大家说一下",
  "今天给大家分享一下",
  "今天给大家讲一下",
  "今天给大家聊一下",
  "今天来跟大家聊一下",
  "今天来跟大家说一下",
  "今天来聊一下",
  "今天来讲一下",
  "先简单说一下",
  "先来说一下",
  "先讲一下",
  "先聊一下",
  "其实就是说",
  "其实就是",
  "也就是说",
  "简单来说",
  "所以说",
  "那就是",
  "那这个",
  "这个呢",
  "那个呢",
  "然后呢",
  "那么呢",
  "然后",
  "那么",
  "其实",
  "就是"
] as const;

type AnalysisDecision = {
  action: "keep" | "remove";
  reason: EditReason;
};

export type TextCleanupRange = {
  start: number;
  end: number;
  reason: Extract<EditReason, "repeat" | "redundant">;
};

export function normalizeText(text: string) {
  return text.replace(/[，。、“”！？,.!?\s]/g, "").trim().toLowerCase();
}

export function isFillerLikeText(text: string) {
  const normalized = normalizeText(text);
  return fillerTokens.has(normalized);
}

function heuristicDecision(segment: TranscriptSegment): AnalysisDecision {
  const normalized = normalizeText(segment.text);
  const duration = Math.max(segment.end - segment.start, 0);

  if (!normalized) {
    return { action: "remove", reason: "noise" };
  }

  if (isFillerLikeText(segment.text)) {
    return { action: "remove", reason: "filler" };
  }

  if (standaloneRedundantTokens.has(normalized)) {
    return { action: "remove", reason: "redundant" };
  }

  if (duration <= 0.45 && normalized.length <= 2) {
    return { action: "remove", reason: "breath" };
  }

  return { action: "keep", reason: "content" };
}

function isSkippableChar(character: string) {
  return punctuationTokens.has(character) || /\s/.test(character);
}

function mergeCleanupRanges(ranges: TextCleanupRange[]) {
  const ordered = [...ranges].sort((left, right) => left.start - right.start);
  const merged: TextCleanupRange[] = [];

  for (const range of ordered) {
    const previous = merged[merged.length - 1];

    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      continue;
    }

    previous.end = Math.max(previous.end, range.end);
    if (previous.reason !== range.reason) {
      previous.reason = "redundant";
    }
  }

  return merged;
}

function detectRedundantStarterRanges(text: string) {
  const characters = Array.from(text);
  const ranges: TextCleanupRange[] = [];
  const clauseSeparators = new Set(["，", ",", "。", ".", "！", "!", "？", "?", "；", ";", "：", ":", "\n"]);

  for (let start = 0; start < characters.length; start += 1) {
    if (start > 0 && !clauseSeparators.has(characters[start - 1])) {
      continue;
    }

    let cursor = start;

    while (cursor < characters.length && isSkippableChar(characters[cursor])) {
      cursor += 1;
    }

    let matched = true;

    while (matched && cursor < characters.length) {
      matched = false;
      const restText = characters.slice(cursor).join("");

      for (const pattern of redundantStarterPatterns) {
        if (!restText.startsWith(pattern)) {
          continue;
        }

        let end = cursor + Array.from(pattern).length;

        while (end < characters.length && /[\s，,、；;：:]/.test(characters[end])) {
          end += 1;
        }

        ranges.push({
          start: cursor,
          end,
          reason: "redundant"
        });
        cursor = end;

        while (cursor < characters.length && isSkippableChar(characters[cursor])) {
          cursor += 1;
        }

        matched = true;
        break;
      }
    }
  }

  return ranges;
}

function isRepeatPhraseCandidate(phrase: string) {
  const characters = Array.from(phrase);

  if (characters.length >= 2) {
    return true;
  }

  return stutterSingleChars.has(phrase);
}

function detectAdjacentRepeatRanges(text: string) {
  const characters = Array.from(text);
  const condensed = characters
    .map((character, index) => ({ character, index }))
    .filter(({ character }) => !isSkippableChar(character));
  const ranges: TextCleanupRange[] = [];

  for (let index = 0; index < condensed.length - 1; index += 1) {
    const maxLength = Math.min(6, Math.floor((condensed.length - index) / 2));

    for (let phraseLength = maxLength; phraseLength >= 1; phraseLength -= 1) {
      const current = condensed
        .slice(index, index + phraseLength)
        .map((item) => item.character)
        .join("");
      const next = condensed
        .slice(index + phraseLength, index + phraseLength * 2)
        .map((item) => item.character)
        .join("");

      if (!current || current !== next || !isRepeatPhraseCandidate(current)) {
        continue;
      }

      ranges.push({
        start: condensed[index].index,
        end: condensed[index + phraseLength].index,
        reason: "repeat"
      });

      index += phraseLength - 1;
      break;
    }
  }

  return ranges;
}

export function getTextCleanupRanges(text: string) {
  return mergeCleanupRanges([
    ...detectRedundantStarterRanges(text),
    ...detectAdjacentRepeatRanges(text)
  ]);
}

function applySequenceHeuristics(
  decisions: Record<string, AnalysisDecision>,
  segments: TranscriptSegment[]
) {
  for (let index = 0; index < segments.length - 1; index += 1) {
    const current = segments[index];
    const next = segments[index + 1];
    const currentText = normalizeText(current.text);
    const nextText = normalizeText(next.text);

    if (
      currentText &&
      nextText &&
      currentText === nextText &&
      currentText.length >= 4 &&
      currentText.length <= 24
    ) {
      decisions[current.id] = {
        action: "remove",
        reason: "repeat"
      };
    }
  }

  return decisions;
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

export async function analyzeTranscriptSegments(segments: TranscriptSegment[]) {
  const fallback = applySequenceHeuristics(
    Object.fromEntries(segments.map((segment) => [segment.id, heuristicDecision(segment)])) as
      Record<string, AnalysisDecision>,
    segments
  );

  const apiKey = process.env.MINIMAX_API_KEY;

  if (!apiKey) {
    return fallback;
  }

  try {
    const baseUrl = process.env.MINIMAX_BASE_URL || "https://api.minimaxi.com/v1";
    const model = process.env.MINIMAX_MODEL || "MiniMax-M1";

    const promptPayload = segments.map((segment) => ({
      id: segment.id,
      text: segment.text,
      start: segment.start,
      end: segment.end,
      duration: Number((segment.end - segment.start).toFixed(3))
    }));

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "你是口播视频粗剪助手。任务：判断每个字幕片段是保留还是删除。删除对象优先包括：气口、停顿、语气词、无意义短促发音、紧邻重复短句、明显废话起手或绕句，如 n、e、o、en、em、uh、um、ah、oh、嗯、呃、额、哦、噢、诶、欸、然后、那么、其实就是说。输出严格 JSON：{\"decisions\":{\"segment-id\":{\"action\":\"keep|remove\",\"reason\":\"content|pause|filler|repeat|redundant|breath|noise|manual\"}}}"
          },
          {
            role: "user",
            content: JSON.stringify({
              instruction: "逐条判断片段是否应删除。只返回 JSON，不要解释。",
              segments: promptPayload
            })
          }
        ]
      })
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      return fallback;
    }

    const jsonText = extractJsonObject(content);

    if (!jsonText) {
      return fallback;
    }

    const parsed = JSON.parse(jsonText) as {
      decisions?: Record<
        string,
        {
          action?: "keep" | "remove";
          reason?: EditReason;
        }
      >;
    };

    const decisions = parsed.decisions ?? {};

    return Object.fromEntries(
      segments.map((segment) => {
        const decision = decisions[segment.id];
        const hasValidReason =
          decision?.reason !== undefined &&
          [
            "content",
            "pause",
            "filler",
            "repeat",
            "redundant",
            "breath",
            "noise",
            "manual"
          ].includes(decision.reason);
        const resolvedReason = hasValidReason
          ? (decision.reason as EditReason)
          : fallback[segment.id].reason;

        return [
          segment.id,
          {
            action:
              decision?.action === "remove" || decision?.action === "keep"
                ? decision.action
                : fallback[segment.id].action,
            reason: resolvedReason
          } satisfies AnalysisDecision
        ];
      })
    ) as Record<string, AnalysisDecision>;
  } catch {
    return fallback;
  }
}
