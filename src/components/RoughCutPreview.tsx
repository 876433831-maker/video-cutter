"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  EditSegment,
  SubtitleFontSize,
  UploadedVideo
} from "@/lib/video-edit-types";
import HelpPopover from "./HelpPopover";

type RoughCutPreviewProps = {
  uploadedVideo: UploadedVideo;
  segments: EditSegment[];
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

function wrapPreviewSubtitle(text: string) {
  const chars = Array.from(text.trim());
  const lines: string[] = [];

  for (let index = 0; index < chars.length; index += 15) {
    lines.push(chars.slice(index, index + 15).join(""));
  }

  return lines.slice(0, 3).join("\n");
}

function formatDuration(seconds: number) {
  const safeValue = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeValue / 60);
  const remainSeconds = safeValue % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

export default function RoughCutPreview({
  uploadedVideo,
  segments,
  subtitleFontSize,
  onSubtitleFontSizeChange,
  playbackRate,
  onPlaybackRateChange,
  volumeGainDb,
  onVolumeGainDbChange
}: RoughCutPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const removedSegments = useMemo(
    () =>
      segments
        .filter((segment) => segment.action === "remove")
        .sort((left, right) => left.start - right.start),
    [segments]
  );

  const keptSegments = useMemo(
    () =>
      segments
        .filter((segment) => segment.action === "keep")
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

  const activeKeptSegment = useMemo(
    () =>
      keptSegments.find(
        (segment) => currentTime >= segment.start && currentTime < segment.end
      ) ?? null,
    [currentTime, keptSegments]
  );

  const activeSubtitleText = useMemo(() => {
    if (!activeKeptSegment || activeKeptSegment.reason === "pause") {
      return "";
    }

    const activeGroupId = activeKeptSegment.groupId;

    if (!activeGroupId) {
      return activeKeptSegment.text.trim();
    }

    return keptSegments
      .filter((segment) => segment.groupId === activeGroupId)
      .map((segment) => segment.text)
      .join("")
      .trim();
  }, [activeKeptSegment, keptSegments]);

  const wrappedSubtitleText = useMemo(
    () => wrapPreviewSubtitle(activeSubtitleText),
    [activeSubtitleText]
  );

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const activePlaybackRate = activeKeptSegment?.speed ?? playbackRate;

    if (Number.isFinite(activePlaybackRate) && activePlaybackRate > 0) {
      video.playbackRate = activePlaybackRate;
    }
  }, [activeKeptSegment, playbackRate]);

  function jumpOverRemovedPart(time: number) {
    const video = videoRef.current;

    if (!video) {
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

  function handlePlayFromStart() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.currentTime = 0;
    jumpOverRemovedPart(0);
    void video.play();
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:sticky md:top-6 md:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-400">粗剪预览</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                左边预览，右边删片段
              </h2>
            </div>
            <HelpPopover
              title="预览说明"
              items={["预览会自动跳过已删片段。", "字号、倍速、音量会同步到导出。"]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
              {subtitleSizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onSubtitleFontSizeChange(size)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    subtitleFontSize === size
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  字号 {size}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
              {playbackRateOptions.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => onPlaybackRateChange(rate)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    playbackRate === rate
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
              {volumeGainOptions.map((gain) => (
                <button
                  key={gain}
                  type="button"
                  onClick={() => onVolumeGainDbChange(gain)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    volumeGainDb === gain
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  音量 +{gain}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handlePlayFromStart}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              从头预览粗剪
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[320px]">
          <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-slate-950">
            <video
              ref={videoRef}
              src={uploadedVideo.previewUrl}
              controls
              playsInline
              onPlay={() => jumpOverRemovedPart(videoRef.current?.currentTime ?? 0)}
              onTimeUpdate={handleTimeUpdate}
              onSeeked={handleSeeked}
              className="aspect-[3/4] w-full bg-black object-contain"
            />

            {wrappedSubtitleText ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center px-4">
                <div
                  className="max-w-[88%] rounded bg-black/85 px-2 py-1 text-center leading-5 whitespace-pre-line text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
                  style={{ fontSize: `${subtitleFontSize}px` }}
                >
                  {wrappedSubtitleText}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-400">当前播放位置</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {formatDuration(currentTime)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-400">粗剪后预计时长</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {formatDuration(estimatedDuration)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-400">已删除片段</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {removedSegments.length} 段
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
