import type { EditReason, EditSegment } from "@/lib/video-edit-types";

export type SegmentGroup = {
  id: string;
  reason: EditReason;
  segments: EditSegment[];
  start: number;
  end: number;
  text: string;
  removedCount: number;
  suggestedRemoval: boolean;
};

export const reasonLabels: Record<EditReason, string> = {
  content: "正文",
  pause: "停顿",
  filler: "语气词",
  repeat: "重复片段",
  redundant: "绕句废话",
  breath: "气口",
  noise: "噪音",
  manual: "手动"
};

export function composeSegmentText(
  segments: EditSegment[],
  options?: {
    respectBreaks?: boolean;
  }
) {
  const respectBreaks = options?.respectBreaks ?? false;

  return segments.reduce((combined, segment) => {
    const nextText = combined + segment.text;

    if (respectBreaks && segment.breakAfter) {
      return `${nextText}\n`;
    }

    return nextText;
  }, "");
}

export function buildSegmentGroups(segments: EditSegment[]) {
  const groups = new Map<string, EditSegment[]>();

  segments.forEach((segment) => {
    const key = segment.groupId || segment.id;
    const current = groups.get(key) ?? [];
    current.push(segment);
    groups.set(key, current);
  });

  return Array.from(groups.entries())
    .map(([id, groupedSegments]) => {
      const orderedSegments = [...groupedSegments].sort(
        (left, right) => (left.unitIndex ?? 0) - (right.unitIndex ?? 0)
      );
      const first = orderedSegments[0];
      const last = orderedSegments[orderedSegments.length - 1];

      return {
        id,
        reason: first.reason,
        segments: orderedSegments,
        start: first.start,
        end: last.end,
        text: composeSegmentText(orderedSegments, { respectBreaks: true }),
        removedCount: orderedSegments.filter((segment) => segment.action === "remove")
          .length,
        suggestedRemoval: orderedSegments.some(
          (segment) => segment.suggestedAction === "remove"
        )
      } satisfies SegmentGroup;
    })
    .sort((left, right) => left.start - right.start);
}

export function getSuggestionStats(groups: SegmentGroup[]) {
  const suggestedRemovalCount = groups.filter((group) => group.suggestedRemoval).length;
  const appliedSuggestedRemovalCount = groups.filter(
    (group) => group.suggestedRemoval && group.removedCount === group.segments.length
  ).length;

  return {
    suggestedRemovalCount,
    appliedSuggestedRemovalCount,
    allSuggestionsApplied:
      suggestedRemovalCount > 0 &&
      appliedSuggestedRemovalCount === suggestedRemovalCount
  };
}
