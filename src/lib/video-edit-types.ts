export type ProjectStage =
  | "upload"
  | "transcribe"
  | "rough-cut"
  | "review"
  | "export";

export type TranscriptSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
  confidence?: number;
  words?: Array<{
    start: number;
    end: number;
    text: string;
    confidence?: number;
  }>;
};

export type EditAction = "keep" | "remove";

export type EditReason =
  | "content"
  | "pause"
  | "filler"
  | "repeat"
  | "redundant"
  | "breath"
  | "noise"
  | "manual";

export type EditSegment = {
  id: string;
  groupId?: string;
  unitIndex?: number;
  unitCount?: number;
  breakAfter?: boolean;
  start: number;
  end: number;
  text: string;
  originalText?: string;
  action: EditAction;
  suggestedAction?: EditAction;
  reason: EditReason;
  speed: number;
  volumeGainDb: number;
};

export type SubtitleFontSize = 8 | 12 | 16;

export type ExportMode = "fast" | "final";

export type UploadedVideo = {
  fileName: string;
  fileSize: number;
  duration: number | null;
  previewUrl: string;
  sourceFile: File;
};

export type TranscriptGenerationResult = {
  transcriptSegments: TranscriptSegment[];
  editSegments: EditSegment[];
};
