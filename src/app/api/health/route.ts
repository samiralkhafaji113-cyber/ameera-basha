import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

/**
 * GET /api/health – uptime probe and post-deploy smoke test. Public and deliberately boring: it reports only whether the
 * app can reach its database as a visitor would (one published-product count). No versions, no config, no error details.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (!isSupabaseConfigured()) return NextResponse.json({ status: "degraded", database: false, source: "static-fallback" }, { status: 503, headers });
  try {
    const { error, count } = await createPublicClient({ cache: false }).from("products").select("id", { count: "exact", head: true }).eq("status", "published");
    if (error) throw error;
    return NextResponse.json({ status: "ok", database: true, published: count ?? 0 }, { headers });
  } catch {
    return NextResponse.json({ status: "error", database: false }, { status: 503, headers });
  }
}
