import { NextResponse } from "next/server";
import { getSessionStore } from "@/lib/session-store";
import { disconnectTikTokLive } from "@/lib/tiktok-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await disconnectTikTokLive();
  getSessionStore().reset();

  return NextResponse.json({ success: true });
}
