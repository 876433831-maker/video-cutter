"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  EditSegment,
  SubtitleFontSize,
  UploadedVideo
} from "@/lib/video-edit-types";
import HelpPopover from "@/components/HelpPopover";
import PreviewStatusBar from "./PreviewStatusBar";
import TimelinePreview from "./TimelinePreview";

type PreviewMonitorProps = {
  uploadedVideo: UploadedVideo | null;
  segments: EditSegment[];
  subtitleFontSize: SubtitleFontSize;
  playbackRate: number;
  volumeGainDb: number;
};

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

export default function PreviewMonitor({
  uploadedVideo,
  segments,
  subtitleFontSize,
  playbackRate,
  volumeGainDb
}: PreviewMonitorProps) {
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
    <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">视频预览</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">实时预览当前剪辑状态</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePlayFromStart}
              disabled={!uploadedVideo}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              从头预览
            </button>
            <HelpPopover
              title="预览区说明"
              items={[
                "字幕大小、倍速和音量会即时体现在预览区。",
                "预览会自动跳过已删除或静音片段。",
                "画面固定按 3:4 竖屏呈现。"
              ]}
            />
          </div>
        </div>

        <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-3">
          {uploadedVideo ? (
            <div className="mx-auto w-full max-w-[300px]">
              <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-slate-950 shadow-sm">
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

                <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[11px] text-white/90 backdrop-blur">
                    <span>3:4 预览</span>
                    <span>·</span>
                    <span>{playbackRate}x</span>
                    <span>·</span>
                    <span>+{volumeGainDb}dB</span>
                  </div>
                </div>

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
          ) : (
            <div className="flex aspect-[3/2] items-center justify-center rounded-[18px] border border-dashed border-slate-300 bg-white text-sm text-slate-500">
              上传视频后，这里显示 3:4 实时预览。
            </div>
          )}
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <PreviewStatusBar
            subtitleFontSize={subtitleFontSize}
            playbackRate={playbackRate}
            volumeGainDb={volumeGainDb}
            currentTimeLabel={formatDuration(currentTime)}
            estimatedDurationLabel={formatDuration(estimatedDuration)}
            removedCount={removedSegments.length}
          />

          <TimelinePreview segments={segments} duration={uploadedVideo?.duration ?? null} />
        </div>
      </div>
    </section>
  );
}
