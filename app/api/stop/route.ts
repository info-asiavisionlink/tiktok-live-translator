import { NextResponse } from "next/server";
import { disconnectTikTokLive } from "@/lib/tiktok-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await disconnectTikTokLive();

  return NextResponse.json({ success: true });
}
