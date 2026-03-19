"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import HelpPopover from "@/components/HelpPopover";
import { composeSegmentText } from "@/lib/transcript-editor";
import type {
  EditSegment,
  SubtitleFontSize,
  UploadedVideo
} from "@/lib/video-edit-types";

type PreviewWorkspaceProps = {
  uploadedVideo: UploadedVideo | null;
  onVideoReady: (video: UploadedVideo | null) => void;
  segments: EditSegment[];
  subtitleFontSize: SubtitleFontSize;
  onSubtitleFontSizeChange: (size: SubtitleFontSize) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  volumeGainDb: number;
  onVolumeGainDbChange: (gain: number) => void;
  isGenerating: boolean;
  hasTranscript: boolean;
};

const subtitleSizeOptions: SubtitleFontSize[] = [16, 12, 8];
const playbackRateOptions = [1, 1.25, 1.5, 1.75, 2];
const volumeGainOptions = [0, 3, 6];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || Number.isNaN(seconds)) {
    return "--:--";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

function wrapPreviewSubtitle(text: string) {
  const lines = text
    .trim()
    .split("\n")
    .flatMap((rawLine) => {
      const chars = Array.from(rawLine.trim());
      const wrappedLines: string[] = [];

      for (let index = 0; index < chars.length; index += 14) {
        wrappedLines.push(chars.slice(index, index + 14).join(""));
      }

      return wrappedLines.length > 0 ? wrappedLines : [""];
    });

  return lines.slice(0, 2).join("\n");
}

export default function PreviewWorkspace({
  uploadedVideo,
  onVideoReady,
  segments,
  subtitleFontSize,
  onSubtitleFontSizeChange,
  playbackRate,
  onPlaybackRateChange,
  volumeGainDb,
  onVolumeGainDbChange,
  isGenerating,
  hasTranscript
}: PreviewWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(uploadedVideo?.sourceFile ?? null);
  const [duration, setDuration] = useState<number | null>(uploadedVideo?.duration ?? null);
  const [currentTime, setCurrentTime] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);

  const previewUrl = useMemo(() => {
    if (!videoFile) {
      return "";
    }

    return URL.createObjectURL(videoFile);
  }, [videoFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!videoFile || !previewUrl) {
      onVideoReady(null);
      return;
    }

    onVideoReady({
      fileName: videoFile.name,
      fileSize: videoFile.size,
      duration,
      previewUrl,
      sourceFile: videoFile
    });
  }, [duration, onVideoReady, previewUrl, videoFile]);

  const keptSegments = useMemo(
    () =>
      segments
        .filter((segment) => segment.action === "keep")
        .sort((left, right) => left.start - right.start),
    [segments]
  );

  const removedSegments = useMemo(
    () =>
      segments
        .filter((segment) => segment.action === "remove")
        .sort((left, right) => left.start - right.start),
    [segments]
  );

  const estimatedDuration = useMemo(
    () =>
      keptSegments.reduce(
        (total, segment) =>
          total + (segment.end - segment.start) / Math.max(segment.speed, 0.1),
        0
      ),
    [keptSegments]
  );

  const activeSubtitleText = useMemo(() => {
    const activeSegment =
      keptSegments.find(
        (segment) => currentTime >= segment.start && currentTime < segment.end
      ) ?? null;

    if (!activeSegment || activeSegment.reason === "pause") {
      return "";
    }

    if (!activeSegment.groupId) {
      return activeSegment.text.trim();
    }

    return composeSegmentText(
      keptSegments.filter((segment) => segment.groupId === activeSegment.groupId),
      { respectBreaks: true }
    ).trim();
  }, [currentTime, keptSegments]);

  const wrappedSubtitleText = useMemo(
    () => wrapPreviewSubtitle(activeSubtitleText),
    [activeSubtitleText]
  );

  const timelineDuration =
    uploadedVideo?.duration && uploadedVideo.duration > 0
      ? uploadedVideo.duration
      : Math.max(...segments.map((segment) => segment.end), 0);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!controlsOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const container = controlsRef.current;

      if (!container) {
        return;
      }

      if (!container.contains(event.target as Node)) {
        setControlsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setControlsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [controlsOpen]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setVideoFile(null);
      setDuration(null);
      return;
    }

    setVideoFile(file);
    setDuration(null);
  }

  function jumpOverRemovedPart(time: number) {
    const video = videoRef.current;

    if (!video || !uploadedVideo) {
      return;
    }

    const matchedRemovedSegment = removedSegments.find(
      (segment) => time >= segment.start && time < segment.end
    );

    if (matchedRemovedSegment) {
      video.currentTime = Math.min(
        matchedRemovedSegment.end + 0.02,
        uploadedVideo.duration ?? matchedRemovedSegment.end + 0.02
      );
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setCurrentTime(video.currentTime);
    jumpOverRemovedPart(video.currentTime);
  }

  function handleSeeked() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setCurrentTime(video.currentTime);
    jumpOverRemovedPart(video.currentTime);
  }

  function openFileDialog() {
    inputRef.current?.click();
  }

  function renderControlGroup<T extends string | number>(
    label: string,
    values: T[],
    currentValue: T,
    formatter: (value: T) => string,
    onChange: (value: T) => void
  ) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/92 p-2 shadow-sm backdrop-blur">
        <div className="mb-1 text-[11px] font-medium text-slate-400">{label}</div>
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <button
              key={`${label}-${String(value)}`}
              type="button"
              onClick={() => onChange(value)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                currentValue === value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {formatter(value)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-[22px] border border-black/6 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="video/*"
        onChange={handleFileChange}
      />

      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.12em] text-slate-400">视频预览</p>
          <div className="mt-1 truncate text-lg font-semibold text-[#111827]">
            {uploadedVideo?.fileName ?? "未上传视频"}
          </div>
          <div className="mt-1 text-sm text-slate-400">
            {uploadedVideo
              ? `${formatDuration(uploadedVideo.duration)} · 竖屏 3:4 · ${
                  hasTranscript ? "自动字幕已开启" : "等待字幕生成"
                }`
              : "上传竖屏 3:4 视频后开始预览与剪辑"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openFileDialog}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            上传视频
          </button>
          <div
            className={`rounded-full px-3 py-1.5 text-xs ${
              isGenerating
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-slate-200 bg-white text-slate-400"
            }`}
          >
            {isGenerating ? "正在处理" : uploadedVideo ? "实时预览已开启" : "等待上传"}
          </div>
          <HelpPopover
            title="预览说明"
            items={[
              "所有处理项都直接在视频预览区体现。",
              "字幕样式、字号、倍速和音量都会联动预览。",
              "时间轴保留在预览卡底部，不再单独占区。"
            ]}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50">
        <div className="relative flex min-h-[540px] w-full items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-6">
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
            <div className="rounded-full border border-slate-200 bg-white/82 px-3 py-1 text-[11px] text-slate-400">
              上传窗口
            </div>
            <div className="rounded-full border border-slate-200 bg-white/82 px-3 py-1 text-[11px] text-slate-400">
              实时预览已开启
            </div>
          </div>

          <div
            ref={controlsRef}
            className="absolute right-4 top-4 z-30"
            onMouseEnter={() => setControlsOpen(true)}
            onMouseLeave={() => setControlsOpen(false)}
          >
            {controlsOpen ? (
              <div className="flex w-[290px] max-w-[calc(100vw-4rem)] flex-col gap-2">
                {renderControlGroup(
                  "播放倍速",
                  playbackRateOptions,
                  playbackRate,
                  (value) => `${value}x`,
                  onPlaybackRateChange
                )}
                {renderControlGroup(
                  "音量增益",
                  volumeGainOptions,
                  volumeGainDb,
                  (value) => `+${value}dB`,
                  onVolumeGainDbChange
                )}
                {renderControlGroup(
                  "字幕大小",
                  subtitleSizeOptions,
                  subtitleFontSize,
                  (value) => `${value}px`,
                  onSubtitleFontSizeChange
                )}
                <div className="rounded-full border border-slate-200 bg-white/92 px-3 py-1.5 text-[11px] text-slate-600 shadow-sm backdrop-blur">
                  停顿/气口片段保留时自动降音：已启用
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setControlsOpen(true)}
                className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-left text-xs shadow-sm backdrop-blur transition hover:bg-white"
              >
                <div className="font-medium text-slate-700">调节</div>
                <div className="mt-0.5 text-[11px] leading-5 text-slate-400">
                  {playbackRate.toFixed(2).replace(/\.00$/, "")}x · +{volumeGainDb}dB · {subtitleFontSize}px
                </div>
              </button>
            )}
          </div>

          {uploadedVideo ? (
            <div className="relative z-10 aspect-[3/4] w-full max-w-[340px] overflow-hidden rounded-[20px] border border-slate-200 bg-black shadow-[0_20px_50px_rgba(15,23,42,0.12)] md:max-w-[380px] xl:max-w-[420px]">
              <video
                ref={videoRef}
                src={uploadedVideo.previewUrl}
                controls
                playsInline
                onPlay={() => jumpOverRemovedPart(videoRef.current?.currentTime ?? 0)}
                onTimeUpdate={handleTimeUpdate}
                onSeeked={handleSeeked}
                className="h-full w-full bg-black object-contain"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={openFileDialog}
                className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white"
              >
                选择视频文件
              </button>
              <div className="text-sm text-slate-400">支持拖拽上传 · 竖屏 3:4</div>
            </div>
          )}

          {wrappedSubtitleText ? (
            <div className="pointer-events-none absolute bottom-8 left-1/2 z-20 w-fit max-w-[300px] -translate-x-1/2">
              <div className="inline-block rounded-[12px] bg-black px-3 py-2 text-center shadow-sm">
                <div
                  className="font-medium leading-snug text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.4)]"
                  style={{ fontSize: `${subtitleFontSize}px` }}
                >
                  {wrappedSubtitleText}
                </div>
              </div>
            </div>
          ) : null}

          <video
            key={previewUrl}
            className="hidden"
            preload="metadata"
            src={previewUrl}
            onLoadedMetadata={(event) => {
              setDuration(event.currentTarget.duration);
            }}
          />
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
            <span>00:00</span>
            <span>{formatDuration(uploadedVideo?.duration ?? timelineDuration)}</span>
          </div>

          <div className="h-10 rounded-full bg-slate-100 p-1">
            <div className="relative h-full overflow-hidden rounded-full bg-slate-200">
              {segments.length === 0 || timelineDuration <= 0 ? null : segments.map((segment) => {
                const left = (segment.start / timelineDuration) * 100;
                const width = Math.max(
                  ((segment.end - segment.start) / timelineDuration) * 100,
                  0.8
                );

                return (
                  <div
                    key={segment.id}
                    className={
                      segment.action === "keep"
                        ? "absolute top-1/2 h-6 -translate-y-1/2 rounded-full bg-[#111827]"
                        : "absolute top-1/2 h-6 -translate-y-1/2 rounded-full bg-slate-300"
                    }
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                );
              })}
            </div>
          </div>

          {uploadedVideo ? (
            <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
              <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2">
                大小：{formatBytes(uploadedVideo.fileSize)}
              </div>
              <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2">
                当前播放：{formatDuration(currentTime)}
              </div>
              <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2">
                粗剪后：{formatDuration(estimatedDuration)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
