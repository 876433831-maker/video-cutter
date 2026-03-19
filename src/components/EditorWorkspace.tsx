"use client";

import { useState } from "react";
import type { UploadedVideo } from "@/lib/video-edit-types";
import TranscriptWorkflowPanel from "./TranscriptWorkflowPanel";
import UploadPanel from "./UploadPanel";

export default function EditorWorkspace() {
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);

  return (
    <>
      <UploadPanel onVideoReady={setUploadedVideo} />
      <TranscriptWorkflowPanel uploadedVideo={uploadedVideo} />
    </>
  );
}
