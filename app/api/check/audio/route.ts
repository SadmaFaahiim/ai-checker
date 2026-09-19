import { NextRequest, NextResponse } from "next/server";
import { detectWithFallback } from "@/lib/fallback";
import { AUDIO_PROVIDERS } from "@/lib/providers/chains";
import { toVerdict } from "@/lib/scoring";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateMagicBytes } from "@/lib/magicBytes";
import { captureServerError } from "@/lib/sentry";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/ogg",
  "audio/flac",
  "audio/webm",
]);

export async function POST(req: NextRequest) {
  const limited = checkRateLimit("audio", req);
  if (limited) return limited;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("audio");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No audio provided." }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only MP3, WAV, M4A, OGG, FLAC, and WEBM audio are supported." },
      { status: 400 }
    );
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio must be smaller than 20MB." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Server-side content sniffing: reject spoofed MIME before any provider call (R3).
    const magic = validateMagicBytes(buffer, file.type);
    if (!magic.ok) {
      return NextResponse.json({ error: magic.reason }, { status: 400 });
    }

    const result = await detectWithFallback(AUDIO_PROVIDERS, {
      kind: "audio",
      buffer,
      mimeType: file.type,
    });

    const percentage = Math.round(result.aiProbability * 100);

    return NextResponse.json({
      percentage,
      verdict: toVerdict(percentage),
      provider: result.providerName,
    });
  } catch (err) {
    console.error("[api/check/audio] all providers failed:", err);
    captureServerError(err, { route: "/api/check/audio", modality: "audio" });
    return NextResponse.json(
      {
        error:
          "Audio detection is temporarily unavailable. Provider API keys need to be configured.",
      },
      { status: 503 }
    );
  }
}
