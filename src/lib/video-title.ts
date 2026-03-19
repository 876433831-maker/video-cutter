import type { EditSegment } from "@/lib/video-edit-types";

const DEFAULT_OUTPUT_TITLE = "导出成片";
const MAX_TITLE_LENGTH = 18;
const INVALID_FILE_NAME_RE = /[<>:"/\\|?*\u0000-\u001F]/g;
const SENTENCE_BREAK_RE = /[。！？!?]/;
const CLAUSE_BREAK_RE = /[，,；;：:\n]/;
const TITLE_PATTERNS = [
  /^大家好[，,\s]*/,
  /^(?:hello|hi)[，,\s]*/i,
  /^今天(?:这期|这一期|想|来|就|主要)?(?:跟大家)?(?:聊聊|聊一聊|聊|说说|说一下|说|讲讲|讲一下|讲|分享一下|分享|带你看|带你聊)?[，,：:\s]*/,
  /^这一期(?:视频)?(?:我们)?(?:来|就)?(?:聊聊|说说|讲讲|分享)?[，,：:\s]*/,
  /^这个视频(?:里)?(?:我们)?(?:来|就)?(?:聊聊|说说|讲讲|分享)?[，,：:\s]*/,
  /^(?:首先|先说|先聊|先讲|先看|比如说|比如|那么|那|然后|最后|其实|就是|所以)[，,：:\s]*/,
  /^第[一二三四五六七八九十百千万0-9]+(?:个|点|步|招|条|部分)?[、，,：:\s]*/,
  /^(?:一|二|三|四|五|六|七|八|九|十)[、，,：:\s]*/
] as const;
const GENERIC_TITLES = new Set([
  "大家好",
  "今天",
  "这一期",
  "这个视频",
  "先说",
  "先聊",
  "先讲",
  "停顿"
]);

function stripExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
}

function limitLength(text: string, maxLength = MAX_TITLE_LENGTH) {
  const characters = Array.from(text);
  return characters.length > maxLength ? characters.slice(0, maxLength).join("") : text;
}

function cleanTitleCandidate(text: string) {
  let current = text.trim().replace(/[""'`“”‘’【】\[\]()（）]/g, "");

  while (current) {
    const next = TITLE_PATTERNS.reduce((value, pattern) => value.replace(pattern, ""), current);

    if (next === current) {
      break;
    }

    current = next.trim();
  }

  return current.replace(/^[\s\-_.]+|[\s\-_.]+$/g, "").trim();
}

function scoreTitleCandidate(candidate: string) {
  const length = Array.from(candidate).length;

  if (length < 4 || GENERIC_TITLES.has(candidate)) {
    return -10;
  }

  let score = 0;

  if (length >= 6 && length <= MAX_TITLE_LENGTH) {
    score += 4;
  } else if (length <= 24) {
    score += 2;
  } else {
    score -= 2;
  }

  if (/[?？]/.test(candidate)) {
    score += 2;
  }

  if (/(如何|怎么|为什么|关键|技巧|方法|步骤|建议|公式|问题|复盘|思路|清单|框架|打法|秘诀|重点)/.test(candidate)) {
    score += 2;
  }

  if (/^[0-9一二三四五六七八九十两]+(?:个|条|步|招)/.test(candidate)) {
    score += 1;
  }

  return score;
}

function extractRawTextFromSegments(segments: EditSegment[]) {
  const text = segments
    .filter(
      (segment) =>
        segment.action === "keep" &&
        !["pause", "breath", "noise"].includes(segment.reason) &&
        segment.text.trim()
    )
    .map((segment) => segment.text.trim())
    .join("");

  return text.replace(/\s+/g, "");
}

function deriveTitleFromText(text: string) {
  const cleanedText = cleanTitleCandidate(text);

  if (!cleanedText) {
    return "";
  }

  const candidates = cleanedText
    .split(SENTENCE_BREAK_RE)
    .flatMap((sentence) => [sentence, ...sentence.split(CLAUSE_BREAK_RE)])
    .map((candidate) => cleanTitleCandidate(candidate))
    .filter(Boolean);

  const bestCandidate = candidates
    .map((candidate) => ({ candidate, score: scoreTitleCandidate(candidate) }))
    .sort((left, right) => right.score - left.score)[0]?.candidate;

  return limitLength(bestCandidate || cleanedText);
}

export function buildVideoTitleFromSegments(
  segments: EditSegment[],
  fallbackFileName?: string
) {
  const derivedTitle = deriveTitleFromText(extractRawTextFromSegments(segments));

  if (derivedTitle) {
    return derivedTitle;
  }

  const fallbackTitle = cleanTitleCandidate(stripExtension(fallbackFileName || ""));
  return limitLength(fallbackTitle || DEFAULT_OUTPUT_TITLE);
}

export function buildOutputFileNameFromSegments(
  segments: EditSegment[],
  fallbackFileName?: string
) {
  const title = buildVideoTitleFromSegments(segments, fallbackFileName);
  const safeTitle = title.replace(INVALID_FILE_NAME_RE, "").trim() || DEFAULT_OUTPUT_TITLE;

  return `${safeTitle}.mp4`;
}
