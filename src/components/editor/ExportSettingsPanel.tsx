import type { ExportMode, SubtitleFontSize } from "@/lib/video-edit-types";

type ExportSettingsPanelProps = {
  exportMode: ExportMode;
  subtitleFontSize: SubtitleFontSize;
  capabilities?: {
    encoder?: string;
    hardwareAccelerated?: boolean;
    profiles?: {
      fast?: {
        targetWidth?: number;
        targetHeight?: number;
        subtitleMode?: "none" | "hard" | "soft";
      };
      final?: {
        targetWidth?: number;
        targetHeight?: number;
        subtitleMode?: "none" | "hard" | "soft";
      };
    };
  } | null;
};

export default function ExportSettingsPanel({
  exportMode,
  subtitleFontSize,
  capabilities
}: ExportSettingsPanelProps) {
  const profile =
    exportMode === "fast" ? capabilities?.profiles?.fast : capabilities?.profiles?.final;
  const resolution = `${profile?.targetWidth ?? (exportMode === "fast" ? 720 : 1080)}×${profile?.targetHeight ?? (exportMode === "fast" ? 960 : 1440)}`;
  const subtitleLabel =
    profile?.subtitleMode === "hard"
      ? `硬字幕 · ${subtitleFontSize}px`
      : profile?.subtitleMode === "soft"
        ? `字幕轨 · ${subtitleFontSize}px`
        : "不带字幕";

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
        exportMode === "fast" ? "快速导出" : "默认成片",
        subtitleLabel,
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
