"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import HelpPopover from "@/components/HelpPopover";
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
  playbackRate: number;
  volumeGainDb: number;
  isGenerating: boolean;
  hasTranscript: boolean;
};

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
  const chars = Array.from(text.trim());
  const lines: string[] = [];

  for (let index = 0; index < chars.length; index += 15) {
    lines.push(chars.slice(index, index + 15).join(""));
  }

  return lines.slice(0, 3).join("\n");
}

export default function PreviewWorkspace({
  uploadedVideo,
  onVideoReady,
  segments,
  subtitleFontSize,
  playbackRate,
  volumeGainDb,
  isGenerating,
  hasTranscript
}: PreviewWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(uploadedVideo?.sourceFile ?? null);
  const [duration, setDuration] = useState<number | null>(uploadedVideo?.duration ?? null);
  const [currentTime, setCurrentTime] = useState(0);

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

    return keptSegments
      .filter((segment) => segment.groupId === activeSegment.groupId)
      .map((segment) => segment.text)
      .join("")
      .trim();
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
          <div className="truncate text-sm font-medium text-[#111827]">
            {uploadedVideo?.fileName ?? "未上传视频"}
          </div>
          <div className="mt-1 text-xs text-slate-400">
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
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
          >
            上传视频
          </button>
          <div
            className={`rounded-full px-3 py-1.5 text-xs ${
              isGenerating
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-slate-200 bg-slate-50 text-slate-500"
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
        <div className="relative flex aspect-[3/4] w-full items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200">
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs text-slate-500">
              上传窗口
            </div>
            <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs text-slate-500">
              实时预览已开启
            </div>
          </div>

          <div className="absolute right-4 top-4 flex flex-col gap-2 text-xs">
            <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-slate-600">
              倍速 {playbackRate.toFixed(1)}x
            </div>
            <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-slate-600">
              音量 {100 + volumeGainDb * 10}%
            </div>
            <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-slate-600">
              字幕大小 {subtitleFontSize}px
            </div>
          </div>

          {uploadedVideo ? (
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
          ) : (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={openFileDialog}
                className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white"
              >
                选择视频文件
              </button>
              <div className="text-sm text-slate-500">支持拖拽上传 · 竖屏 3:4</div>
            </div>
          )}

          {wrappedSubtitleText ? (
            <div className="pointer-events-none absolute bottom-6 left-1/2 w-[76%] -translate-x-1/2">
              <div className="rounded-[16px] bg-black/78 px-4 py-3 text-center shadow-sm">
                <div className="text-[11px] tracking-wide text-white/55">字幕预览</div>
                <div
                  className="mt-1 font-medium text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.4)]"
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

          <div className="mb-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              停顿删除：预览中
            </div>
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              音量变化：预览中
            </div>
            <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              字幕样式：预览中
            </div>
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
            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
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
