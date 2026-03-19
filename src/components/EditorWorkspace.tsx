"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PreviewWorkspace from "@/components/editor/PreviewWorkspace";
import VideoProcessingPanel from "@/components/editor/VideoProcessingPanel";
import { buildSegmentGroups, getSuggestionStats } from "@/lib/transcript-editor";
import type {
  SubtitleFontSize,
  TranscriptGenerationResult,
  UploadedVideo
} from "@/lib/video-edit-types";
import ExportPanel from "./ExportPanel";
import TranscriptWorkflowPanel from "./TranscriptWorkflowPanel";

const LEFT_PANE_WIDTH_KEY = "video-cutter:left-pane-width";

export default function EditorWorkspace() {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);
  const [result, setResult] = useState<TranscriptGenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [editableSegments, setEditableSegments] =
    useState<TranscriptGenerationResult["editSegments"]>([]);
  const [subtitleFontSize, setSubtitleFontSize] = useState<SubtitleFontSize>(16);
  const [playbackRate, setPlaybackRate] = useState(1.5);
  const [volumeGainDb, setVolumeGainDb] = useState(3);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [leftPaneRatio, setLeftPaneRatio] = useState(68);
  const [transcribeStatus, setTranscribeStatus] = useState<{
    minimaxAvailable: boolean;
    volcengineAvailable: boolean;
    provider?: "volcengine" | "whisper" | "none";
    ffmpegAvailable: boolean;
    whisperModelAvailable: boolean;
    whisperModelPath?: string;
  } | null>(null);

  useEffect(() => {
    function syncViewport() {
      setIsDesktop(window.innerWidth >= 1024);
    }

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    const savedRatio = window.localStorage.getItem(LEFT_PANE_WIDTH_KEY);

    if (!savedRatio) {
      return;
    }

    const parsed = Number(savedRatio);

    if (Number.isFinite(parsed)) {
      setLeftPaneRatio(Math.min(75, Math.max(45, parsed)));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LEFT_PANE_WIDTH_KEY, String(leftPaneRatio));
  }, [leftPaneRatio]);

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
  const groupedSegments = useMemo(() => buildSegmentGroups(editSegments), [editSegments]);
  const { suggestedRemovalCount, appliedSuggestedRemovalCount, allSuggestionsApplied } =
    useMemo(() => getSuggestionStats(groupedSegments), [groupedSegments]);

  useEffect(() => {
    if (!isDesktop || !isResizing) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const layout = layoutRef.current;

      if (!layout) {
        return;
      }

      const bounds = layout.getBoundingClientRect();
      const nextRatio = ((event.clientX - bounds.left) / bounds.width) * 100;
      setLeftPaneRatio(Math.min(75, Math.max(45, nextRatio)));
    }

    function handlePointerUp() {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDesktop, isResizing]);

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

  function handleToggleSuggested() {
    setEditableSegments((currentSegments) =>
      currentSegments.map((segment) =>
        segment.suggestedAction === "remove"
          ? {
              ...segment,
              action: allSuggestionsApplied ? "keep" : "remove"
            }
          : segment
      )
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={layoutRef}
        className="grid gap-0 lg:items-start"
        style={
          isDesktop
            ? {
                gridTemplateColumns: `${leftPaneRatio}fr 18px ${100 - leftPaneRatio}fr`
              }
            : undefined
        }
      >
        <PreviewWorkspace
          uploadedVideo={uploadedVideo}
          onVideoReady={setUploadedVideo}
          segments={editSegments}
          subtitleFontSize={subtitleFontSize}
          playbackRate={playbackRate}
          volumeGainDb={volumeGainDb}
          isGenerating={isGenerating}
          hasTranscript={Boolean(result)}
        />

        <div className="hidden lg:flex items-stretch justify-center px-1">
          <button
            type="button"
            aria-label="调整左右面板宽度"
            onPointerDown={() => setIsResizing(true)}
            className="group flex w-full cursor-col-resize items-center justify-center"
          >
            <div
              className={`h-full w-[2px] rounded-full bg-slate-200 transition ${
                isResizing ? "bg-slate-500" : "group-hover:bg-slate-400"
              }`}
            />
          </button>
        </div>

        <TranscriptWorkflowPanel
          uploadedVideo={uploadedVideo}
          result={result}
          isGenerating={isGenerating}
          errorMessage={errorMessage}
          transcribeStatus={transcribeStatus}
          transcriptTextCount={transcriptTextCount}
          keptCount={keptCount}
          removedCount={removedCount}
          suggestedRemovalCount={suggestedRemovalCount}
          appliedSuggestedRemovalCount={appliedSuggestedRemovalCount}
          allSuggestionsApplied={allSuggestionsApplied}
          segments={editSegments}
          onSegmentsChange={setEditableSegments}
          onGenerateTranscript={handleGenerateTranscript}
          onToggleSuggested={handleToggleSuggested}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <VideoProcessingPanel
          disabled={!result}
          subtitleFontSize={subtitleFontSize}
          onSubtitleFontSizeChange={setSubtitleFontSize}
          playbackRate={playbackRate}
          onPlaybackRateChange={setPlaybackRate}
          volumeGainDb={volumeGainDb}
          onVolumeGainDbChange={setVolumeGainDb}
        />

        <div className="lg:sticky lg:top-[72px]">
          <ExportPanel
            uploadedVideo={uploadedVideo}
            segments={editSegments}
            subtitleFontSize={subtitleFontSize}
          />
        </div>
      </div>
    </div>
  );
}
