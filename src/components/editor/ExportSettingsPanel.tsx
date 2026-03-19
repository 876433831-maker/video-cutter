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
    <div className="flex flex-wrap gap-2">
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
  );
}
