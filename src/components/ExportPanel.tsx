"use client";

import { useEffect, useMemo, useState } from "react";
import ExportSettingsPanel from "@/components/editor/ExportSettingsPanel";
import ProcessingProgressPanel from "@/components/editor/ProcessingProgressPanel";
import type { EditSegment, SubtitleFontSize, UploadedVideo } from "@/lib/video-edit-types";

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
      formData.append("exportMode", "final");

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
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">最终导出</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">导出成片</h2>
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
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {!uploadedVideo
            ? "请先上传视频"
            : isExporting
              ? "导出中..."
              : "导出成片"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
          保留 {keptSegments.length} 段
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
          预计 {formatDuration(totalOutputSeconds)}
        </span>
        <span
          className={`rounded-full px-3 py-1.5 text-sm ${
            ffmpegAvailable
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {ffmpegAvailable
            ? capabilities?.hardwareAccelerated
              ? "硬件编码 + 硬字幕"
              : "CPU 编码 + 硬字幕"
            : "ffmpeg 未就绪"}
        </span>
      </div>

      <ExportSettingsPanel
        subtitleFontSize={subtitleFontSize}
        capabilities={capabilities}
      />

      <ProcessingProgressPanel
        progress={progress}
        ready={Boolean(uploadedVideo && keptSegments.length > 0)}
        errorMessage={errorMessage}
      />
    </section>
  );
}
