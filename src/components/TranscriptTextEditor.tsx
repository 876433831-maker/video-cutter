"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EditReason, EditSegment } from "@/lib/video-edit-types";

type TranscriptTextEditorProps = {
  segments: EditSegment[];
  onChange: (segments: EditSegment[]) => void;
};

type SegmentGroup = {
  id: string;
  reason: EditReason;
  segments: EditSegment[];
  start: number;
  end: number;
  text: string;
  removedCount: number;
  suggestedRemoval: boolean;
};

const reasonLabels: Record<EditReason, string> = {
  content: "正文",
  pause: "停顿",
  filler: "语气词",
  breath: "气口",
  noise: "噪音",
  manual: "手动"
};

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

function formatGapDuration(seconds: number) {
  return `${seconds.toFixed(1)}s`;
}

function chunkSegments<T>(segments: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < segments.length; index += size) {
    chunks.push(segments.slice(index, index + size));
  }

  return chunks;
}

function buildGroups(segments: EditSegment[]) {
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
        text: orderedSegments.map((segment) => segment.text).join(""),
        removedCount: orderedSegments.filter((segment) => segment.action === "remove")
          .length,
        suggestedRemoval: orderedSegments.some(
          (segment) => segment.suggestedAction === "remove"
        )
      } satisfies SegmentGroup;
    })
    .sort((left, right) => left.start - right.start);
}

export default function TranscriptTextEditor({
  segments,
  onChange
}: TranscriptTextEditorProps) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showRemovedOnly, setShowRemovedOnly] = useState(false);
  const [dragSelection, setDragSelection] = useState<{
    groupId: string;
    startIndex: number;
    endIndex: number;
  } | null>(null);
  const isDraggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const groupedSegments = useMemo(() => buildGroups(segments), [segments]);

  const suggestedRemovalCount = groupedSegments.filter((group) => group.suggestedRemoval).length;
  const appliedSuggestedRemovalCount = groupedSegments.filter(
    (group) => group.suggestedRemoval && group.removedCount === group.segments.length
  ).length;
  const removedCount = groupedSegments.filter(
    (group) => group.removedCount === group.segments.length
  ).length;
  const allSuggestionsApplied =
    suggestedRemovalCount > 0 &&
    appliedSuggestedRemovalCount === suggestedRemovalCount;

  const filteredGroups = useMemo(() => {
    return groupedSegments.filter((group) => {
      const matchedKeyword =
        !searchKeyword ||
        group.text.includes(searchKeyword) ||
        reasonLabels[group.reason].includes(searchKeyword);
      const matchedRemovedState = !showRemovedOnly || group.removedCount > 0;

      return matchedKeyword && matchedRemovedState;
    });
  }, [groupedSegments, searchKeyword, showRemovedOnly]);

  function updateSegmentsByIds(
    ids: string[],
    updater: (segment: EditSegment) => EditSegment
  ) {
    const idSet = new Set(ids);
    onChange(segments.map((segment) => (idSet.has(segment.id) ? updater(segment) : segment)));
  }

  function handleToggleSuggested() {
    const targetIds = segments
      .filter((segment) => segment.suggestedAction === "remove")
      .map((segment) => segment.id);

    updateSegmentsByIds(targetIds, (segment) => ({
      ...segment,
      action: allSuggestionsApplied ? "keep" : "remove"
    }));
  }

  function handleRestoreAll() {
    onChange(
      segments.map((segment) => ({
        ...segment,
        text: segment.originalText ?? segment.text,
        action: segment.suggestedAction === "remove" ? "remove" : "keep",
        reason: segment.suggestedAction === "remove" ? segment.reason : "content"
      }))
    );
  }

  function handleToggleGroup(group: SegmentGroup) {
    const shouldRestore = group.removedCount === group.segments.length;

    updateSegmentsByIds(
      group.segments.map((segment) => segment.id),
      (segment) => ({
        ...segment,
        action: shouldRestore ? "keep" : "remove",
        reason:
          shouldRestore && segment.suggestedAction !== "remove"
            ? "content"
            : segment.reason === "content"
              ? "manual"
              : segment.reason
      })
    );
  }

  function handleToggleCharacter(segment: EditSegment) {
    updateSegmentsByIds([segment.id], (currentSegment) => ({
      ...currentSegment,
      action: currentSegment.action === "remove" ? "keep" : "remove",
      reason:
        currentSegment.action === "remove"
          ? currentSegment.suggestedAction === "remove"
            ? currentSegment.reason
            : "manual"
          : currentSegment.reason === "content"
            ? "manual"
            : currentSegment.reason
    }));
  }

  function getSelectionRange(groupId: string) {
    if (!dragSelection || dragSelection.groupId !== groupId) {
      return null;
    }

    return {
      start: Math.min(dragSelection.startIndex, dragSelection.endIndex),
      end: Math.max(dragSelection.startIndex, dragSelection.endIndex)
    };
  }

  function beginDragSelection(groupId: string, index: number) {
    isDraggingRef.current = true;
    setDragSelection({
      groupId,
      startIndex: index,
      endIndex: index
    });
  }

  function updateDragSelection(groupId: string, index: number) {
    if (!isDraggingRef.current) {
      return;
    }

    setDragSelection((currentSelection) => {
      if (!currentSelection || currentSelection.groupId !== groupId) {
        return currentSelection;
      }

      return {
        ...currentSelection,
        endIndex: index
      };
    });
  }

  function finishDragSelection(group: SegmentGroup) {
    if (!isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;
    const range = getSelectionRange(group.id);

    if (!range) {
      setDragSelection(null);
      return;
    }

    const selectedSegments = group.segments.slice(range.start, range.end + 1);

    if (selectedSegments.length === 0) {
      setDragSelection(null);
      return;
    }

    const shouldRestore = selectedSegments.every((segment) => segment.action === "remove");

    updateSegmentsByIds(
      selectedSegments.map((segment) => segment.id),
      (segment) => ({
        ...segment,
        action: shouldRestore ? "keep" : "remove",
        reason:
          shouldRestore && segment.suggestedAction !== "remove"
            ? "content"
            : segment.reason === "content"
              ? "manual"
              : segment.reason
      })
    );

    suppressClickRef.current = true;
    setDragSelection(null);
  }

  useEffect(() => {
    function handlePointerUp() {
      isDraggingRef.current = false;
      setDragSelection(null);
    }

    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, []);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">文字剪辑面板</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">逐字删片段</h3>
          </div>
          <div className="text-sm text-slate-500">已删除 {removedCount} 行</div>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row">
          <label className="flex min-w-0 flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="mr-3 text-slate-400">⌕</span>
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
              placeholder="输入关键词快速定位"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowRemovedOnly((value) => !value)}
              className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                showRemovedOnly
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {showRemovedOnly ? "显示全部" : "仅看已删"}
            </button>
            <button
              type="button"
              onClick={handleRestoreAll}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              重置
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
              建议删除 {suggestedRemovalCount} 行 · 已应用 {appliedSuggestedRemovalCount} 行
            </div>

            <button
              type="button"
              onClick={handleToggleSuggested}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {allSuggestionsApplied ? "恢复建议片段" : "删除建议片段"}
            </button>
          </div>

          <p className="text-sm text-slate-500">点字删除，拖字批量删。</p>
        </div>

        <div className="max-h-[720px] overflow-y-auto pr-1">
          {filteredGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-sm text-slate-500">
              没有匹配的字幕片段。
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {filteredGroups.map((group, index) => {
                const duration = Math.max(0, group.end - group.start);
                const isPauseLike = group.reason === "pause" || group.reason === "breath";
                const fullyRemoved = group.removedCount === group.segments.length;
                const selectionRange = getSelectionRange(group.id);
                const segmentRows = chunkSegments(group.segments, 15);

                return (
                  <div
                    key={group.id}
                    className={`px-4 ${isPauseLike ? "py-2.5" : "py-4"} ${
                      fullyRemoved ? "bg-slate-50" : "bg-white"
                    } ${index !== filteredGroups.length - 1 ? "border-b border-slate-100" : ""}`}
                  >
                    <div className="flex gap-4">
                      <div className={`shrink-0 ${isPauseLike ? "pt-0.5" : "pt-1"}`}>
                        <div
                          className={`rounded-xl bg-slate-100 font-semibold tracking-tight text-slate-900 ${
                            isPauseLike ? "px-2.5 py-1 text-base" : "px-3 py-2 text-xl"
                          }`}
                        >
                          {formatDuration(group.start)}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-medium">{reasonLabels[group.reason]}</span>
                              <span>
                                {formatDuration(group.start)} - {formatDuration(group.end)}
                              </span>
                              {isPauseLike ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                                  {formatGapDuration(duration)}
                                </span>
                              ) : null}
                              {group.removedCount > 0 ? (
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-600">
                                  已删 {group.removedCount}/{group.segments.length}
                                </span>
                              ) : null}
                            </div>

                            {isPauseLike ? (
                              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                                <span className="truncate">停顿</span>
                                <span className="text-slate-300">·</span>
                                <span className="truncate">这段会在粗剪和导出时被跳过</span>
                              </div>
                            ) : (
                              <div className="mt-3 space-y-2">
                                <div className="text-xs text-slate-400">
                                  拖动选中字后松开，即可删除；再次拖选已删除字可恢复。
                                </div>
                                <div className="space-y-1 border-b-2 border-dashed border-sky-200 pb-2">
                                  {segmentRows.map((segmentRow, rowIndex) => (
                                    <div
                                      key={`${group.id}-row-${rowIndex}`}
                                      className="flex min-h-10 flex-wrap gap-x-0.5"
                                    >
                                      {segmentRow.map((segment, columnIndex) => {
                                        const segmentIndex = rowIndex * 15 + columnIndex;
                                        const isSelected =
                                          selectionRange &&
                                          segmentIndex >= selectionRange.start &&
                                          segmentIndex <= selectionRange.end;

                                        return (
                                          <button
                                            key={segment.id}
                                            type="button"
                                            onMouseDown={() =>
                                              beginDragSelection(group.id, segmentIndex)
                                            }
                                            onMouseEnter={() =>
                                              updateDragSelection(group.id, segmentIndex)
                                            }
                                            onMouseUp={() => finishDragSelection(group)}
                                            onClick={() => {
                                              if (suppressClickRef.current) {
                                                suppressClickRef.current = false;
                                                return;
                                              }

                                              handleToggleCharacter(segment);
                                            }}
                                            className={`rounded px-0.5 text-[20px] leading-9 transition ${
                                              isSelected
                                                ? "bg-sky-100 text-slate-900"
                                                : segment.action === "remove"
                                                  ? "bg-slate-200 text-slate-400 line-through"
                                                  : "text-slate-900 hover:bg-slate-100"
                                            }`}
                                          >
                                            {segment.text === " " ? "\u00A0" : segment.text}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleGroup(group)}
                              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                fullyRemoved
                                  ? "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                                  : "bg-slate-900 text-white hover:bg-slate-800"
                              }`}
                            >
                              {fullyRemoved ? "恢复" : "删除整行"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
