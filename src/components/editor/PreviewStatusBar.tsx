import type { SubtitleFontSize } from "@/lib/video-edit-types";

type PreviewStatusBarProps = {
  subtitleFontSize: SubtitleFontSize;
  playbackRate: number;
  volumeGainDb: number;
  currentTimeLabel: string;
  estimatedDurationLabel: string;
  removedCount: number;
};

function StatusChip({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

export default function PreviewStatusBar({
  subtitleFontSize,
  playbackRate,
  volumeGainDb,
  currentTimeLabel,
  estimatedDurationLabel,
  removedCount
}: PreviewStatusBarProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <StatusChip label="字幕大小" value={`${subtitleFontSize}px`} />
      <StatusChip label="字幕样式" value="白字 + 黑底框" />
      <StatusChip label="播放倍速" value={`${playbackRate}x`} />
      <StatusChip label="音量增益" value={`+${volumeGainDb}dB`} />
      <StatusChip label="静音片段" value="自动压低背景音" />
      <StatusChip label="当前播放" value={currentTimeLabel} />
      <StatusChip label="粗剪时长" value={`${estimatedDurationLabel} · 已删 ${removedCount}`} />
    </div>
  );
}
