type ProcessingProgressPanelProps = {
  progress: {
    percent: number;
    stage: string;
    elapsedMs: number;
  } | null;
  ready: boolean;
  errorMessage?: string;
};

function formatTimer(milliseconds: number) {
  const safeSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(safeSeconds / 60);
  const remainSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

export default function ProcessingProgressPanel({
  progress,
  ready,
  errorMessage
}: ProcessingProgressPanelProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-full flex-col gap-4">
        <div>
          <p className="text-sm text-slate-400">处理进度</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">导出任务与处理状态</h3>
        </div>

        {progress ? (
          <>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
              <p className="text-sm font-medium text-sky-700">{progress.stage}</p>
              <p className="mt-1 text-xs text-sky-600">
                已等待 {formatTimer(progress.elapsedMs)}
              </p>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-sky-100">
              <div
                className="h-full rounded-full bg-sky-600 transition-[width] duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <div className="text-sm text-slate-500">
              当前进度 <span className="font-medium text-slate-900">{Math.round(progress.percent)}%</span>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            {errorMessage
              ? `上一次导出失败：${errorMessage}`
              : ready
                ? "导出尚未开始，点击下方导出按钮后这里显示真实进度。"
                : "生成字幕后，这里显示真实处理进度。"}
          </div>
        )}
      </div>
    </section>
  );
}
