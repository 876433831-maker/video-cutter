"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  SubtitleFontSize,
  TranscriptGenerationResult,
  UploadedVideo
} from "@/lib/video-edit-types";
import ExportPanel from "./ExportPanel";
import HelpPopover from "./HelpPopover";
import RoughCutPreview from "./RoughCutPreview";
import TranscriptTextEditor from "./TranscriptTextEditor";

type TranscriptWorkflowPanelProps = {
  uploadedVideo: UploadedVideo | null;
};

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

export default function TranscriptWorkflowPanel({
  uploadedVideo
}: TranscriptWorkflowPanelProps) {
  const [result, setResult] = useState<TranscriptGenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [editableSegments, setEditableSegments] =
    useState<TranscriptGenerationResult["editSegments"]>([]);
  const [subtitleFontSize, setSubtitleFontSize] = useState<SubtitleFontSize>(16);
  const [playbackRate, setPlaybackRate] = useState(1.5);
  const [volumeGainDb, setVolumeGainDb] = useState(3);
  const [transcribeStatus, setTranscribeStatus] = useState<{
    minimaxAvailable: boolean;
    volcengineAvailable: boolean;
    provider?: "volcengine" | "whisper" | "none";
    ffmpegAvailable: boolean;
    whisperModelAvailable: boolean;
    whisperModelPath?: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        const response = await fetch("/api/transcribe");
        const payload = (await response.json()) as {
          minimaxAvailable?: boolean;
          volcengineAvailable?: boolean;
          provider?: "volcengine" | "whisper" | "none";
          ffmpegAvailable?: boolean;
          whisperModelAvailable?: boolean;
          whisperModelPath?: string;
        };

        if (isMounted) {
          setTranscribeStatus({
            minimaxAvailable: Boolean(payload.minimaxAvailable),
            volcengineAvailable: Boolean(payload.volcengineAvailable),
            provider: payload.provider,
            ffmpegAvailable: Boolean(payload.ffmpegAvailable),
            whisperModelAvailable: Boolean(payload.whisperModelAvailable),
            whisperModelPath: payload.whisperModelPath
          });
        }
      } catch {
        if (isMounted) {
          setTranscribeStatus({
            minimaxAvailable: false,
            volcengineAvailable: false,
            provider: "none",
            ffmpegAvailable: false,
            whisperModelAvailable: false
          });
        }
      }
    }

    loadStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setResult(null);
    setEditableSegments([]);
    setErrorMessage("");
    setIsGenerating(false);
    setSubtitleFontSize(16);
    setPlaybackRate(1.5);
    setVolumeGainDb(3);
  }, [uploadedVideo]);

  useEffect(() => {
    setEditableSegments((currentSegments) => {
      if (currentSegments.length === 0) {
        return currentSegments;
      }

      return currentSegments.map((segment) =>
        segment.reason === "pause"
          ? {
              ...segment,
              speed: 1,
              volumeGainDb: 0
            }
          : {
              ...segment,
              speed: playbackRate,
              volumeGainDb
            }
      );
    });
  }, [playbackRate, volumeGainDb]);

  const editSegments = editableSegments;
  const keptCount = editSegments.filter((segment) => segment.action === "keep").length;
  const removedCount = editSegments.length - keptCount;
  const transcriptTextCount = useMemo(
    () =>
      new Set(
        editSegments
          .filter(
            (segment) =>
              segment.reason !== "pause" &&
              segment.text.trim().length > 0 &&
              segment.groupId
          )
          .map((segment) => segment.groupId)
      ).size,
    [editSegments]
  );

  async function handleGenerateTranscript() {
    if (!uploadedVideo) {
      return;
    }

    setIsGenerating(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", uploadedVideo.sourceFile);
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "字幕生成失败，请稍后重试。");
      }

      const payload = (await response.json()) as TranscriptGenerationResult;
      const normalizedSegments = payload.editSegments.map((segment) =>
        segment.reason === "pause"
          ? {
              ...segment,
              speed: 1,
              volumeGainDb: 0
            }
          : {
              ...segment,
              speed: playbackRate,
              volumeGainDb
            }
      );

      setResult(payload);
      setEditableSegments(normalizedSegments);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "字幕生成失败，请稍后重试。";
      setErrorMessage(message);
      setResult(null);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-start gap-3">
              <div>
                <p className="text-sm font-medium text-slate-400">第 3 步</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  生成字幕并做 AI 粗剪
                </h2>
              </div>
              <HelpPopover
                title="字幕面板说明"
                items={[
                  "点击生成字幕后，会跑真实转写接口。",
                  "右侧可以按字删除、拖选删除、恢复整行。",
                  "左侧预览会跳过已删除片段。"
                ]}
              />
            </div>

            <button
              type="button"
              disabled={!uploadedVideo || isGenerating}
              onClick={handleGenerateTranscript}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {!uploadedVideo
                ? "请先上传视频"
                : isGenerating
                  ? "生成中..."
                  : result
                    ? "重新生成字幕"
                    : "生成字幕"}
            </button>
          </div>

          {!uploadedVideo ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              上传视频后，这里会出现字幕结果和粗剪面板。
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-400">当前文件</p>
                  <p className="mt-1 truncate font-medium text-slate-900">
                    {uploadedVideo.fileName}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-400">视频时长</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {uploadedVideo.duration ? formatDuration(uploadedVideo.duration) : "--:--"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-400">字幕状态</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {result ? "已生成" : "待生成"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-400">当前模式</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {transcribeStatus?.provider === "volcengine" ? "豆包语音识别" : "本地回退"}
                  </p>
                </div>
              </div>

              {transcribeStatus ? (
                <div
                  className={`rounded-[22px] border px-5 py-4 text-sm ${
                    transcribeStatus.ffmpegAvailable
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {transcribeStatus.ffmpegAvailable
                    ? transcribeStatus.minimaxAvailable
                      ? "环境正常：豆包转写 + MiniMax 粗剪。"
                      : "环境正常：当前使用本地回退转写。"
                    : "环境未就绪：缺少 ffmpeg 或转写模型。"}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                  {errorMessage}
                </div>
              ) : null}

              {!result ? (
                <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">
                  生成后，这里会出现字幕与粗剪结果。
                </div>
              ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-start">
                  <RoughCutPreview
                    uploadedVideo={uploadedVideo}
                    segments={editSegments}
                    subtitleFontSize={subtitleFontSize}
                    onSubtitleFontSizeChange={setSubtitleFontSize}
                    playbackRate={playbackRate}
                    onPlaybackRateChange={setPlaybackRate}
                    volumeGainDb={volumeGainDb}
                    onVolumeGainDbChange={setVolumeGainDb}
                  />

                  <div className="space-y-4">
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                      当前可编辑文字块 {transcriptTextCount} 段 · 保留 {keptCount} 段 · 删除{" "}
                      {removedCount} 段
                    </div>
                    <TranscriptTextEditor
                      segments={editSegments}
                      onChange={setEditableSegments}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {result ? (
        <ExportPanel
          uploadedVideo={uploadedVideo}
          segments={editSegments}
          subtitleFontSize={subtitleFontSize}
        />
      ) : null}
    </div>
  );
}
