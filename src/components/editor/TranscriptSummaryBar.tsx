type TranscriptSummaryBarProps = {
  fileName?: string;
  durationLabel: string;
  subtitleStatus: string;
  providerLabel: string;
  transcriptTextCount: number;
  keptCount: number;
  removedCount: number;
};

export default function TranscriptSummaryBar({
  providerLabel,
  transcriptTextCount,
  keptCount,
  removedCount
}: TranscriptSummaryBarProps) {
  const values = [
    `识别 ${providerLabel}`,
    `文字块 ${transcriptTextCount} 段`,
    `保留/删除 ${keptCount}/${removedCount}`
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <div key={value} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
          <p className="truncate text-xs text-slate-500">{value}</p>
        </div>
      ))}
    </div>
  );
}
