import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { detectWithFallback } from "@/lib/fallback";
import { gptZeroProvider } from "@/lib/providers/text/gptzero";
import { saplingProvider } from "@/lib/providers/text/sapling";
import { zeroGptProvider } from "@/lib/providers/text/zerogpt";
import { toVerdict } from "@/lib/scoring";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().trim().min(20, "Please provide at least 20 characters of text."),
});

export async function POST(req: NextRequest) {
  const limited = checkRateLimit("text", req);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  try {
    // Priority order: Sapling (primary — only provider with a configured key) -> GPTZero -> ZeroGPT (last resort)
    const result = await detectWithFallback(
      [saplingProvider, gptZeroProvider, zeroGptProvider],
      { kind: "text", text: parsed.data.text }
    );

    const percentage = Math.round(result.aiProbability * 100);

    return NextResponse.json({
      percentage,
      verdict: toVerdict(percentage),
      provider: result.providerName,
    });
  } catch (err) {
    console.error("[api/check/text] all providers failed:", err);
    return NextResponse.json(
      { error: "Detection is temporarily unavailable, please try again shortly." },
      { status: 503 }
    );
  }
}
