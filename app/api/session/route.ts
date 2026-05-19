import { NextResponse } from "next/server";
import { getSessionStore } from "@/lib/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = getSessionStore().getSnapshot();

  return NextResponse.json({
    success: true,
    username: snapshot.username,
    transcript: snapshot.transcripts[0] ?? null,
    transcripts: snapshot.transcripts,
    comments: snapshot.comments,
    gifts: snapshot.gifts,
    status: snapshot.status,
  });
}
