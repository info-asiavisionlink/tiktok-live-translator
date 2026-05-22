import { NextResponse } from "next/server";
import { getSessionStore } from "@/lib/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = getSessionStore().getSnapshot();

  const currentTranscript =
    snapshot.transcripts.length > 0
      ? snapshot.transcripts[snapshot.transcripts.length - 1]
      : null;

  console.log("[session] Returning transcript:", currentTranscript?.original);

  return NextResponse.json({
    success: true,
    username: snapshot.username,
    currentTranscript,
    transcript: currentTranscript,
    currentPartialTranscript: snapshot.currentPartialTranscript,
    currentPartialTranslation: snapshot.currentPartialTranslation,
    transcripts: snapshot.transcripts,
    comments: snapshot.comments,
    gifts: snapshot.gifts,
    status: snapshot.status,
    totalCommentCount: snapshot.status.totalCommentCount,
  });
}
