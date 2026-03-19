type TranscriptSummaryBarProps = {
  fileName?: string;
  durationLabel: string;
  subtitleStatus: string;
  providerLabel: string;
  transcriptTextCount: number;
  keptCount: number;
  removedCount: number;
};

const summaryItems = [
  "文件",
  "时长",
  "字幕",
  "识别",
  "文字块",
  "保留/删除"
] as const;

export default function TranscriptSummaryBar({
  fileName,
  durationLabel,
  subtitleStatus,
  providerLabel,
  transcriptTextCount,
  keptCount,
  removedCount
}: TranscriptSummaryBarProps) {
  const values = [
    fileName ?? "未上传",
    durationLabel,
    subtitleStatus,
    providerLabel,
    `${transcriptTextCount} 段`,
    `${keptCount} / ${removedCount}`
  ];

  return (
    <div className="grid gap-2 rounded-[24px] border border-slate-200 bg-white p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {summaryItems.map((label, index) => (
        <div
          key={label}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-1 truncate text-sm font-medium text-slate-900">{values[index]}</p>
        </div>
      ))}
    </div>
  );
}
