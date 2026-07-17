import { NextRequest, NextResponse } from "next/server";
import { detectWithFallback } from "@/lib/fallback";
import { sightengineImageProvider } from "@/lib/providers/image/sightengine";
import { aiOrNotImageProvider } from "@/lib/providers/image/aiornot";
import { toVerdict } from "@/lib/scoring";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export async function POST(req: NextRequest) {
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

    const result = await detectWithFallback(
      [sightengineImageProvider, aiOrNotImageProvider],
      { kind: "image", buffer, mimeType: file.type }
    );

    const percentage = Math.round(result.aiProbability * 100);

    return NextResponse.json({
      percentage,
      verdict: toVerdict(percentage),
      provider: result.providerName,
    });
  } catch (err) {
    console.error("[api/check/image] all providers failed:", err);
    return NextResponse.json(
      {
        error:
          "Image detection is temporarily unavailable. Provider API keys need to be configured.",
      },
      { status: 503 }
    );
  }
}
