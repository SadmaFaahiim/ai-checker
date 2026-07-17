import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { extractFrames } from "@/lib/videoFrames";
import { detectWithFallback } from "@/lib/fallback";
import { sightengineImageProvider } from "@/lib/providers/image/sightengine";
import { aiOrNotImageProvider } from "@/lib/providers/image/aiornot";
import { toVerdict } from "@/lib/scoring";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = new Set(["video/mp4"]);
const FRAME_SAMPLE_COUNT = 8;

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("video");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No video provided." }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only MP4 videos are supported." },
      { status: 400 }
    );
  }

  if (file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json(
      { error: "Video must be smaller than 20MB." },
      { status: 400 }
    );
  }

  const tmpPath = path.join(os.tmpdir(), `${Date.now()}-${randomUUID()}.mp4`);
  await fs.writeFile(tmpPath, Buffer.from(await file.arrayBuffer()));

  try {
    let frames: Buffer[];
    try {
      frames = await extractFrames(tmpPath, FRAME_SAMPLE_COUNT);
    } catch (err) {
      console.error("[api/check/video] frame extraction failed:", err);
      return NextResponse.json(
        { error: "Could not read the uploaded video file." },
        { status: 400 }
      );
    }

    if (frames.length === 0) {
      return NextResponse.json(
        { error: "Could not extract any frames from the uploaded video." },
        { status: 400 }
      );
    }

    const frameResults = await Promise.all(
      frames.map((buffer) =>
        detectWithFallback([sightengineImageProvider, aiOrNotImageProvider], {
          kind: "image",
          buffer,
          mimeType: "image/jpeg",
        })
      )
    );

    const scores = frameResults.map((r) => Math.round(r.aiProbability * 100));
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const provider = frameResults[0]?.providerName ?? "unknown";

    return NextResponse.json({
      percentage: avg,
      verdict: toVerdict(avg),
      provider,
      perFrame: scores,
    });
  } catch (err) {
    console.error("[api/check/video] all providers failed:", err);
    return NextResponse.json(
      {
        error:
          "Video detection is temporarily unavailable. Provider API keys need to be configured.",
      },
      { status: 503 }
    );
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
