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

type AnalysisDecision = {
  action: "keep" | "remove";
  reason: EditReason;
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

  if (duration <= 0.45 && normalized.length <= 2) {
    return { action: "remove", reason: "breath" };
  }

  return { action: "keep", reason: "content" };
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
  const fallback = Object.fromEntries(
    segments.map((segment) => [segment.id, heuristicDecision(segment)])
  ) as Record<string, AnalysisDecision>;

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
              "你是口播视频粗剪助手。任务：判断每个字幕片段是保留还是删除。删除对象优先包括：气口、停顿、语气词、无意义短促发音，如 n、e、o、en、em、uh、um、ah、oh、嗯、呃、额、哦、噢、诶、欸。输出严格 JSON：{\"decisions\":{\"segment-id\":{\"action\":\"keep|remove\",\"reason\":\"content|pause|filler|breath|noise|manual\"}}}"
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
        return [
          segment.id,
          {
            action:
              decision?.action === "remove" || decision?.action === "keep"
                ? decision.action
                : fallback[segment.id].action,
            reason:
              decision?.reason &&
              ["content", "pause", "filler", "breath", "noise", "manual"].includes(
                decision.reason
              )
                ? decision.reason
                : fallback[segment.id].reason
          } satisfies AnalysisDecision
        ];
      })
    ) as Record<string, AnalysisDecision>;
  } catch {
    return fallback;
  }
}
