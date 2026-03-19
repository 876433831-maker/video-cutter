type AISuggestionPanelProps = {
  suggestedRemovalCount: number;
  appliedSuggestedRemovalCount: number;
  allSuggestionsApplied: boolean;
  disabled?: boolean;
  onToggleSuggested: () => void;
};

export default function AISuggestionPanel({
  suggestedRemovalCount,
  appliedSuggestedRemovalCount,
  allSuggestionsApplied,
  disabled,
  onToggleSuggested
}: AISuggestionPanelProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-full flex-col gap-4">
        <div>
          <p className="text-sm text-slate-400">AI 建议</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">建议删除片段和应用状态</h3>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">建议删除</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">
                {suggestedRemovalCount} 段
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">已应用</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">
                {appliedSuggestedRemovalCount} 段
              </p>
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          AI 会优先标记停顿、气口、语气词和明显无效片段。你仍然可以在右侧逐字微调。
        </div>

        <button
          type="button"
          disabled={disabled || suggestedRemovalCount === 0}
          onClick={onToggleSuggested}
          className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {allSuggestionsApplied ? "恢复 AI 建议片段" : "应用 AI 建议"}
        </button>
      </div>
    </section>
  );
}
