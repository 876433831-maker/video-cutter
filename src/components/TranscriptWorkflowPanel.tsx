"use client";

import type {
  SubtitleFontSize,
  TranscriptGenerationResult,
  UploadedVideo
} from "@/lib/video-edit-types";
import TranscriptHeader from "@/components/editor/TranscriptHeader";
import TranscriptSummaryBar from "@/components/editor/TranscriptSummaryBar";
import TranscriptTextEditor from "./TranscriptTextEditor";

type TranscriptWorkflowPanelProps = {
  uploadedVideo: UploadedVideo | null;
  result: TranscriptGenerationResult | null;
  isGenerating: boolean;
  errorMessage: string;
  transcribeStatus: {
    minimaxAvailable: boolean;
    volcengineAvailable: boolean;
    provider?: "volcengine" | "whisper" | "none";
    ffmpegAvailable: boolean;
    whisperModelAvailable: boolean;
    whisperModelPath?: string;
  } | null;
  transcriptTextCount: number;
  keptCount: number;
  removedCount: number;
  segments: TranscriptGenerationResult["editSegments"];
  onSegmentsChange: (segments: TranscriptGenerationResult["editSegments"]) => void;
  onGenerateTranscript: () => void;
};

function formatDuration(seconds: number | null) {
  if (!seconds) {
    return "--:--";
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

export default function TranscriptWorkflowPanel({
  uploadedVideo,
  result,
  isGenerating,
  errorMessage,
  transcribeStatus,
  transcriptTextCount,
  keptCount,
  removedCount,
  segments,
  onSegmentsChange,
  onGenerateTranscript
}: TranscriptWorkflowPanelProps) {
  const providerLabel =
    transcribeStatus?.provider === "volcengine" ? "豆包语音识别" : "本地回退";

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <TranscriptHeader
          hasVideo={Boolean(uploadedVideo)}
          hasResult={Boolean(result)}
          isGenerating={isGenerating}
          onGenerate={onGenerateTranscript}
        />

        <TranscriptSummaryBar
          fileName={uploadedVideo?.fileName}
          durationLabel={formatDuration(uploadedVideo?.duration ?? null)}
          subtitleStatus={result ? "已生成" : "待生成"}
          providerLabel={providerLabel}
          transcriptTextCount={transcriptTextCount}
          keptCount={keptCount}
          removedCount={removedCount}
        />

        {transcribeStatus ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
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
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {!uploadedVideo ? (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
            上传视频后，右侧出现字幕与粗剪编辑区。
          </div>
        ) : !result ? (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-sm text-slate-500">
            先生成字幕，再开始逐字删片和时间轴粗剪。
          </div>
        ) : (
          <TranscriptTextEditor
            segments={segments}
            onChange={onSegmentsChange}
            showSuggestionControls={false}
          />
        )}
      </div>
    </section>
  );
}
