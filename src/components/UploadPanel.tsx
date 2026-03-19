"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { UploadedVideo } from "@/lib/video-edit-types";
import HelpPopover from "./HelpPopover";

type UploadPanelProps = {
  onVideoReady?: (video: UploadedVideo | null) => void;
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

export default function UploadPanel({ onVideoReady }: UploadPanelProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

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
      onVideoReady?.(null);
      return;
    }

    onVideoReady?.({
      fileName: videoFile.name,
      fileSize: videoFile.size,
      duration,
      previewUrl,
      sourceFile: videoFile
    });
  }, [duration, onVideoReady, previewUrl, videoFile]);

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

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">视频上传</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">上传素材并读取时长信息</h2>
          </div>
          <HelpPopover
            title="上传说明"
            items={["选择一个本地视频文件。", "上传后会读取时长并进入字幕面板。"]}
          />
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-slate-400 hover:bg-slate-100">
          <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
            选择视频文件
          </span>
          <span className="text-sm text-slate-500">支持 MP4、WebM、MOV</span>
          <input className="hidden" type="file" accept="video/*" onChange={handleFileChange} />
        </label>

        {previewUrl ? (
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div className="min-w-0">
                <span className="text-slate-400">文件：</span>
                <span className="break-all font-medium text-slate-900">{videoFile?.name}</span>
              </div>
              <div>
                <span className="text-slate-400">大小：</span>
                <span className="font-medium text-slate-900">
                  {videoFile ? formatBytes(videoFile.size) : "--"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">时长：</span>
                <span className="font-medium text-slate-900">{formatDuration(duration)}</span>
              </div>
              <div>
                <span className="text-slate-400">状态：</span>
                <span className="font-medium text-slate-900">已加载</span>
              </div>
            </div>

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
        ) : null}
      </div>
    </section>
  );
}
