import type { ExportMode, SubtitleFontSize } from "@/lib/video-edit-types";

type ExportSettingsPanelProps = {
  exportMode: ExportMode;
  subtitleFontSize: SubtitleFontSize;
  onExportModeChange: (mode: ExportMode) => void;
  capabilities?: {
    encoder?: string;
    hardwareAccelerated?: boolean;
    profiles?: {
      fast?: {
        targetWidth?: number;
        targetHeight?: number;
      };
      final?: {
        targetWidth?: number;
        targetHeight?: number;
      };
    };
  } | null;
};

export default function ExportSettingsPanel({
  exportMode,
  subtitleFontSize,
  onExportModeChange,
  capabilities
}: ExportSettingsPanelProps) {
  const resolution =
    exportMode === "fast"
      ? `${capabilities?.profiles?.fast?.targetWidth ?? 720}×${capabilities?.profiles?.fast?.targetHeight ?? 960}`
      : `${capabilities?.profiles?.final?.targetWidth ?? 1080}×${capabilities?.profiles?.final?.targetHeight ?? 1440}`;

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
          <h3 className="mt-1 text-lg font-semibold text-slate-950">导出模式与输出摘要</h3>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => onExportModeChange("fast")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              exportMode === "fast"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-white"
            }`}
          >
            预览导出
          </button>
          <button
            type="button"
            onClick={() => onExportModeChange("final")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              exportMode === "final"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-white"
            }`}
          >
            最终导出
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">
            {exportMode === "fast"
              ? "用于快速检查，不做正式成片发布。"
              : "用于平台发布，保留硬字幕压制。"}
          </p>

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
