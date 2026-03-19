import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import { transcribeVideo } from "@/lib/transcribe-video";

function getCommandStatus(command: string, args: string[] = []) {
  try {
    execFileSync(command, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const ffmpegAvailable = getCommandStatus("ffmpeg", ["-version"]);
  const whisperModelPath = process.env.WHISPER_MODEL_PATH;

  return NextResponse.json({
    minimaxAvailable: Boolean(process.env.MINIMAX_API_KEY),
    volcengineAvailable: Boolean(
      process.env.VOLCENGINE_APP_KEY && process.env.VOLCENGINE_ACCESS_KEY
    ),
    provider:
      process.env.VOLCENGINE_APP_KEY && process.env.VOLCENGINE_ACCESS_KEY
        ? "volcengine"
        : "none",
    ffmpegAvailable,
    whisperModelAvailable: Boolean(whisperModelPath),
    whisperModelPath
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少视频文件。" }, { status: 400 });
    }

    const result = await transcribeVideo(file);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "字幕生成失败，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
