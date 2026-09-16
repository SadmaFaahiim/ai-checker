import { NextResponse } from "next/server";
import { getHealthReport } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Operational status for uptime monitors and ops dashboards. Never calls any
 * vendor API — it only reports which provider credentials are configured.
 * Always returns 200: "degraded" (no keys configured) is a health state, not
 * a failed probe.
 */
export async function GET() {
  return NextResponse.json(getHealthReport());
}
