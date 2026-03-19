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
  if (!progress && !errorMessage) {
    return null;
  }

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {progress ? progress.stage : "导出失败"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {progress ? `已等待 ${formatTimer(progress.elapsedMs)}` : "请调整后重试"}
            </p>
          </div>

          {progress ? (
            <span className="text-sm font-medium text-slate-900">
              {Math.round(progress.percent)}%
            </span>
          ) : null}
        </div>

        {progress ? (
          <>
            <div className="h-2.5 overflow-hidden rounded-full bg-sky-100">
              <div
                className="h-full rounded-full bg-sky-600 transition-[width] duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage || "导出失败，请稍后重试。"}
          </div>
        )}
      </div>
    </section>
  );
}
