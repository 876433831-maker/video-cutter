import type { SubtitleFontSize } from "@/lib/video-edit-types";

type ExportSettingsPanelProps = {
  subtitleFontSize: SubtitleFontSize;
  capabilities?: {
    encoder?: string;
    hardwareAccelerated?: boolean;
    profiles?: {
      final?: {
        targetWidth?: number;
        targetHeight?: number;
      };
    };
  } | null;
};

export default function ExportSettingsPanel({
  subtitleFontSize,
  capabilities
}: ExportSettingsPanelProps) {
  const resolution = `${capabilities?.profiles?.final?.targetWidth ?? 1080}×${capabilities?.profiles?.final?.targetHeight ?? 1440}`;

  const encoderLabel = capabilities?.encoder
    ? capabilities.hardwareAccelerated
      ? `${capabilities.encoder} · 硬件`
      : `${capabilities.encoder} · CPU`
    : "--";

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-full flex-col gap-3">
        <div>
          <p className="text-sm text-slate-400">导出设置</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">最终导出摘要</h3>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">预览直接在上方窗口查看，导出只保留最终成片。</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              resolution,
              "3:4 竖屏",
              "MP4",
              "白字 + 黑底框",
              `${subtitleFontSize}px`,
              encoderLabel
            ].map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                {item}
              </span>
            ))}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            字幕大小跟随上方“视频处理”设置联动到预览和导出。
          </p>
        </div>
      </div>
    </section>
  );
}
