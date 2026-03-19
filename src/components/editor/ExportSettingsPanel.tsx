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

function SettingRow({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

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

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-full flex-col gap-4">
        <div>
          <p className="text-sm text-slate-400">导出设置</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">分辨率、字幕样式和输出格式</h3>
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
          <SettingRow label="分辨率" value={resolution} />
          <SettingRow label="比例" value="3:4 竖屏" />
          <SettingRow label="格式" value="MP4" />
          <SettingRow label="字幕样式" value="白字 + 黑底框" />
          <SettingRow label="字幕大小" value={`${subtitleFontSize}px`} />
          <SettingRow
            label="编码器"
            value={
              capabilities?.encoder
                ? capabilities.hardwareAccelerated
                  ? `${capabilities.encoder} · 硬件`
                  : `${capabilities.encoder} · CPU`
                : "--"
            }
          />
        </div>
      </div>
    </section>
  );
}
