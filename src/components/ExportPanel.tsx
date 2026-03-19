"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  EditSegment,
  ExportMode,
  SubtitleFontSize,
  UploadedVideo
} from "@/lib/video-edit-types";
import HelpPopover from "./HelpPopover";

type ExportPanelProps = {
  uploadedVideo: UploadedVideo | null;
  segments: EditSegment[];
  subtitleFontSize: SubtitleFontSize;
};

type ExportProgressState = {
  percent: number;
  stage: string;
  elapsedMs: number;
};

type ExportCapabilities = {
  encoder?: string;
  hardwareAccelerated?: boolean;
  profiles?: {
    fast?: {
      label?: string;
      targetWidth?: number;
      targetHeight?: number;
      hardSubtitle?: boolean;
    };
    final?: {
      label?: string;
      targetWidth?: number;
      targetHeight?: number;
      hardSubtitle?: boolean;
    };
  };
};

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

function formatTimer(milliseconds: number) {
  const safeSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(safeSeconds / 60);
  const remainSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

function buildOutputFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex === -1) {
    return `${fileName}-edited.mp4`;
  }

  return `${fileName.slice(0, dotIndex)}-edited.mp4`;
}

export default function ExportPanel({
  uploadedVideo,
  segments,
  subtitleFontSize
}: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);
  const [capabilities, setCapabilities] = useState<ExportCapabilities | null>(null);
  const [exportMode, setExportMode] = useState<ExportMode>("fast");
  const [progress, setProgress] = useState<ExportProgressState | null>(null);
  const [exportStartedAt, setExportStartedAt] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const keptSegments = useMemo(
    () => segments.filter((segment) => segment.action === "keep"),
    [segments]
  );

  const totalOutputSeconds = useMemo(
    () =>
      keptSegments.reduce(
        (total, segment) => total + (segment.end - segment.start) / segment.speed,
        0
      ),
    [keptSegments]
  );

  useEffect(() => {
    let mounted = true;

    async function loadExportStatus() {
      try {
        const response = await fetch("/api/export");
        const payload = (await response.json()) as {
          available?: boolean;
          encoder?: string;
          hardwareAccelerated?: boolean;
          profiles?: ExportCapabilities["profiles"];
        };

        if (mounted) {
          setFfmpegAvailable(Boolean(payload.available));
          setCapabilities({
            encoder: payload.encoder,
            hardwareAccelerated: payload.hardwareAccelerated,
            profiles: payload.profiles
          });
        }
      } catch {
        if (mounted) {
          setFfmpegAvailable(false);
          setCapabilities(null);
        }
      }
    }

    loadExportStatus();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isExporting || exportStartedAt === null || !jobId) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/export?jobId=${encodeURIComponent(jobId)}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as {
          status?: "queued" | "running" | "completed" | "failed";
          progress?: number;
          stage?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "导出状态读取失败。");
        }

        const elapsedMs = Date.now() - exportStartedAt;

        setProgress({
          percent: Math.min(Math.max(payload.progress ?? 0, 0), 100),
          stage: payload.stage || "正在导出",
          elapsedMs
        });

        if (payload.status === "completed") {
          const downloadResponse = await fetch(
            `/api/export?jobId=${encodeURIComponent(jobId)}&download=1`
          );

          if (!downloadResponse.ok) {
            const downloadPayload = (await downloadResponse.json()) as { error?: string };
            throw new Error(downloadPayload.error || "导出文件下载失败。");
          }

          const blob = await downloadResponse.blob();
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = buildOutputFileName(uploadedVideo?.fileName ?? "output.mp4");
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(downloadUrl);

          window.clearInterval(timer);
          setProgress({
            percent: 100,
            stage: "导出完成，浏览器开始下载",
            elapsedMs
          });

          window.setTimeout(() => {
            setIsExporting(false);
            setJobId(null);
            setProgress(null);
            setExportStartedAt(null);
          }, 800);
        }

        if (payload.status === "failed") {
          throw new Error(payload.error || "导出失败，请稍后重试。");
        }
      } catch (error) {
        window.clearInterval(timer);
        const message =
          error instanceof Error ? error.message : "导出失败，请稍后重试。";
        setErrorMessage(message);
        setIsExporting(false);
        setJobId(null);
        setProgress(null);
        setExportStartedAt(null);
      }
    }, 500);

    return () => {
      window.clearInterval(timer);
    };
  }, [exportStartedAt, isExporting, jobId, uploadedVideo?.fileName]);

  async function handleExport() {
    if (!uploadedVideo) {
      return;
    }

    setIsExporting(true);
    setErrorMessage("");
    setExportStartedAt(Date.now());
    setProgress({
      percent: 4,
      stage: "正在创建导出任务",
      elapsedMs: 0
    });

    try {
      const formData = new FormData();
      formData.append("file", uploadedVideo.sourceFile);
      formData.append("segments", JSON.stringify(segments));
      formData.append("subtitleFontSize", String(subtitleFontSize));
      formData.append("exportMode", exportMode);

      const response = await fetch("/api/export", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as { error?: string; jobId?: string };

      if (!response.ok || !payload.jobId) {
        throw new Error(payload.error || "导出失败，请稍后重试。");
      }

      setJobId(payload.jobId);
      setProgress({
        percent: 6,
        stage: "导出任务已创建，正在处理",
        elapsedMs: 0
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "导出失败，请稍后重试。";
      setErrorMessage(message);
      setProgress(null);
      setExportStartedAt(null);
      setIsExporting(false);
    }
  }

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-8">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-sm font-medium text-slate-400">第 4 步</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">导出剪辑结果</h2>
            </div>
            <HelpPopover
              title="导出说明"
              items={[
                "预览导出只用于快速检查结果，不做硬字幕烧录。",
                "最终导出会把字幕直接压进 MP4 画面。"
              ]}
            />
          </div>

          <button
            type="button"
            disabled={
              !uploadedVideo ||
              keptSegments.length === 0 ||
              isExporting ||
              ffmpegAvailable === false
            }
            onClick={handleExport}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {!uploadedVideo
              ? "请先上传视频"
              : isExporting
                ? "导出中..."
                : exportMode === "final"
                  ? "最终导出"
                  : "预览导出"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setExportMode("fast")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                exportMode === "fast"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              预览导出
            </button>
            <button
              type="button"
              onClick={() => setExportMode("final")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                exportMode === "final"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              最终导出
            </button>
          </div>

          <p className="text-sm text-slate-500">
            {exportMode === "fast"
              ? "720×960，快速检查，不做硬字幕烧录"
              : "1080×1440，平台发布，保留硬字幕"}
          </p>
        </div>

        {progress ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-sky-700">{progress.stage}</p>
                  <p className="mt-1 text-xs text-sky-600">
                    已等待 {formatTimer(progress.elapsedMs)}
                  </p>
                </div>
                <div className="text-sm font-semibold text-sky-700">
                  {Math.round(progress.percent)}%
                </div>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-sky-100">
                <div
                  className="h-full rounded-full bg-sky-600 transition-[width] duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-400">保留片段</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {keptSegments.length} 段
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-400">预计成片时长</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatDuration(totalOutputSeconds)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-400">编码器</p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {capabilities?.encoder ?? "--"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-400">字幕字号</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {subtitleFontSize}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-400">输出规格</p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {exportMode === "fast"
                ? `${capabilities?.profiles?.fast?.targetWidth ?? 720}×${capabilities?.profiles?.fast?.targetHeight ?? 960}`
                : `${capabilities?.profiles?.final?.targetWidth ?? 1080}×${capabilities?.profiles?.final?.targetHeight ?? 1440}`}
            </p>
          </div>
        </div>

        <div
          className={`rounded-2xl border px-5 py-4 text-sm ${
            ffmpegAvailable
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {ffmpegAvailable
            ? exportMode === "final"
              ? capabilities?.hardwareAccelerated
                ? "导出环境正常：最终导出会走硬件编码 + 硬字幕烧录。"
                : "导出环境正常：最终导出会走 CPU 编码 + 硬字幕烧录。"
              : "预览导出只用于快速检查，不会触发整条视频正式烧录。"
            : "导出环境未就绪：系统里还没有可用的 ffmpeg。"}
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
}
