import type { SubtitleFontSize } from "@/lib/video-edit-types";

type VideoProcessingPanelProps = {
  disabled?: boolean;
  subtitleFontSize: SubtitleFontSize;
  onSubtitleFontSizeChange: (size: SubtitleFontSize) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  volumeGainDb: number;
  onVolumeGainDbChange: (gain: number) => void;
};

const subtitleSizeOptions: SubtitleFontSize[] = [16, 12, 8];
const playbackRateOptions = [1, 1.25, 1.5, 1.75, 2];
const volumeGainOptions = [0, 3, 6];

function ControlGroup<T extends string | number>({
  title,
  values,
  currentValue,
  disabled,
  formatter,
  onChange
}: {
  title: string;
  values: T[];
  currentValue: T;
  disabled?: boolean;
  formatter: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <button
            key={String(value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value)}
            className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
              currentValue === value
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400`}
          >
            {formatter(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function VideoProcessingPanel({
  disabled,
  subtitleFontSize,
  onSubtitleFontSizeChange,
  playbackRate,
  onPlaybackRateChange,
  volumeGainDb,
  onVolumeGainDbChange
}: VideoProcessingPanelProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm text-slate-400">视频处理</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">预览与成片共用的处理参数</h3>
        </div>

        <ControlGroup
          title="字幕大小"
          values={subtitleSizeOptions}
          currentValue={subtitleFontSize}
          disabled={disabled}
          formatter={(value) => `${value}px`}
          onChange={onSubtitleFontSizeChange}
        />

        <ControlGroup
          title="播放倍速"
          values={playbackRateOptions}
          currentValue={playbackRate}
          disabled={disabled}
          formatter={(value) => `${value}x`}
          onChange={onPlaybackRateChange}
        />

        <ControlGroup
          title="音量增益"
          values={volumeGainOptions}
          currentValue={volumeGainDb}
          disabled={disabled}
          formatter={(value) => `+${value}dB`}
          onChange={onVolumeGainDbChange}
        />

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          静音片段自动压低背景音：<span className="font-medium text-slate-900">已启用</span>
        </div>
      </div>
    </section>
  );
}
