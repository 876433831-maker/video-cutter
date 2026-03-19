import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import {
  consumeExportJobOutput,
  createExportJob,
  failExportJob,
  getExportJob,
  setExportJobOutput,
  updateExportJob
} from "@/lib/export-jobs";
import { exportEditedVideo } from "@/lib/export-video";
import type { EditSegment, ExportMode, SubtitleFontSize } from "@/lib/video-edit-types";

function buildOutputName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex === -1) {
    return `${fileName}-edited.mp4`;
  }

  return `${fileName.slice(0, dotIndex)}-edited.mp4`;
}

function getFfmpegStatus() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function parseExportRequest(formData: FormData) {
  const file = formData.get("file");
  const segmentsInput = formData.get("segments");
  const subtitleFontSizeInput = formData.get("subtitleFontSize");
  const exportModeInput = formData.get("exportMode");

  if (!(file instanceof File)) {
    throw new Error("缺少视频文件，无法导出。");
  }

  if (typeof segmentsInput !== "string") {
    throw new Error("缺少剪辑片段数据，无法导出。");
  }

  const subtitleFontSize =
    subtitleFontSizeInput === "8" ||
    subtitleFontSizeInput === "12" ||
    subtitleFontSizeInput === "16"
      ? (Number(subtitleFontSizeInput) as SubtitleFontSize)
      : 12;
  const exportMode: ExportMode = exportModeInput === "final" ? "final" : "fast";
  const segments = JSON.parse(segmentsInput) as EditSegment[];

  return {
    file,
    segments,
    subtitleFontSize,
    exportMode
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const download = searchParams.get("download");

  if (!jobId) {
    return NextResponse.json({
      available: getFfmpegStatus()
    });
  }

  const job = getExportJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "导出任务不存在或已过期。" }, { status: 404 });
  }

  if (download === "1") {
    if (job.status !== "completed") {
      return NextResponse.json({ error: "导出尚未完成。" }, { status: 409 });
    }

    const output = consumeExportJobOutput(jobId);

    if (!output) {
      return NextResponse.json({ error: "导出文件已被下载或已过期。" }, { status: 410 });
    }

    return new NextResponse(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(buildOutputName(job.fileName))}"`
      }
    });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    error: job.error
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const { file, segments, subtitleFontSize, exportMode } = parseExportRequest(formData);
    const job = createExportJob(file.name);

    void exportEditedVideo({
      file,
      segments,
      subtitleFontSize,
      exportMode,
      onProgress: ({ percent, stage }) => {
        updateExportJob(job.id, {
          status: "running",
          progress: Math.min(Math.max(percent, 0), 100),
          stage
        });
      }
    })
      .then((output) => {
        setExportJobOutput(job.id, output);
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "导出失败，请稍后重试。";
        failExportJob(job.id, message);
      });

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "导出失败，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
