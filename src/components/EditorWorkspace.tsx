"use client";

import { useEffect, useMemo, useState } from "react";
import PreviewMonitor from "@/components/editor/PreviewMonitor";
import VideoProcessingPanel from "@/components/editor/VideoProcessingPanel";
import { buildSegmentGroups, getSuggestionStats } from "@/lib/transcript-editor";
import type {
  SubtitleFontSize,
  TranscriptGenerationResult,
  UploadedVideo
} from "@/lib/video-edit-types";
import ExportPanel from "./ExportPanel";
import TranscriptWorkflowPanel from "./TranscriptWorkflowPanel";
import UploadPanel from "./UploadPanel";

export default function EditorWorkspace() {
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);
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
  const groupedSegments = useMemo(() => buildSegmentGroups(editSegments), [editSegments]);
  const { suggestedRemovalCount, appliedSuggestedRemovalCount, allSuggestionsApplied } =
    useMemo(() => getSuggestionStats(groupedSegments), [groupedSegments]);

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
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)] xl:items-start">
        <div className="space-y-3 xl:sticky xl:top-[72px]">
          <UploadPanel onVideoReady={setUploadedVideo} />
          <PreviewMonitor
            uploadedVideo={uploadedVideo}
            segments={editSegments}
            subtitleFontSize={subtitleFontSize}
            playbackRate={playbackRate}
            volumeGainDb={volumeGainDb}
          />
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <VideoProcessingPanel
          disabled={!result}
          subtitleFontSize={subtitleFontSize}
          onSubtitleFontSizeChange={setSubtitleFontSize}
          playbackRate={playbackRate}
          onPlaybackRateChange={setPlaybackRate}
          volumeGainDb={volumeGainDb}
          onVolumeGainDbChange={setVolumeGainDb}
        />

        <ExportPanel
          uploadedVideo={uploadedVideo}
          segments={editSegments}
          subtitleFontSize={subtitleFontSize}
        />
      </div>
    </div>
  );
}
