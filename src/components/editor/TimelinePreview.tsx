import type { EditSegment } from "@/lib/video-edit-types";

type TimelinePreviewProps = {
  segments: EditSegment[];
  duration: number | null;
};

function formatDuration(seconds: number) {
  const safeValue = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeValue / 60);
  const remainSeconds = safeValue % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

export default function TimelinePreview({
  segments,
  duration
}: TimelinePreviewProps) {
  const safeDuration =
    duration && duration > 0
      ? duration
      : Math.max(...segments.map((segment) => segment.end), 0);

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-slate-400">时间轴预览</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">保留与删除片段分布</h3>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <div className="flex h-6 w-full">
            {segments.length === 0 || safeDuration <= 0 ? (
              <div className="flex flex-1 items-center justify-center text-xs text-slate-400">
                生成字幕后显示时间轴
              </div>
            ) : (
              segments.map((segment) => {
                const widthPercent = Math.max(
                  ((segment.end - segment.start) / safeDuration) * 100,
                  0.8
                );

                return (
                  <div
                    key={segment.id}
                    title={`${segment.action === "keep" ? "保留" : "删除"} · ${formatDuration(
                      segment.start
                    )} - ${formatDuration(segment.end)}`}
                    className={
                      segment.action === "keep"
                        ? "h-full border-r border-white/70 bg-slate-900/85"
                        : "h-full border-r border-white/70 bg-slate-300"
                    }
                    style={{ width: `${widthPercent}%` }}
                  />
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>00:00</span>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-900/85" />
              保留
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              删除
            </span>
          </div>
          <span>{formatDuration(safeDuration)}</span>
        </div>
      </div>
    </section>
  );
}
