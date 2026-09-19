import { NextRequest, NextResponse } from "next/server";
import { detectWithFallback } from "@/lib/fallback";
import { IMAGE_PROVIDERS } from "@/lib/providers/chains";
import { toVerdict } from "@/lib/scoring";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateMagicBytes } from "@/lib/magicBytes";
import { captureServerError } from "@/lib/sentry";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export async function POST(req: NextRequest) {
  const limited = checkRateLimit("image", req);
  if (limited) return limited;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPG and PNG images are supported." },
      { status: 400 }
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image must be smaller than 10MB." },
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

    const result = await detectWithFallback(IMAGE_PROVIDERS, {
      kind: "image",
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
    console.error("[api/check/image] all providers failed:", err);
    captureServerError(err, { route: "/api/check/image", modality: "image" });
    return NextResponse.json(
      {
        error:
          "Image detection is temporarily unavailable. Provider API keys need to be configured.",
      },
      { status: 503 }
    );
  }
}
