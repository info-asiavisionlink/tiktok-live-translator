import { NextResponse } from "next/server";
import { getSessionStore } from "@/lib/session-store";
import { submitTranscript } from "@/lib/transcript-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TranscriptRequestBody {
  text?: string;
  translated?: string;
  timestamp?: string;
}

/** Ingest streamer speech from n8n (e.g. after Whisper) and optionally apply translation */
export async function POST(request: Request) {
  let body: TranscriptRequestBody;

  try {
    body = (await request.json()) as TranscriptRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json(
      { success: false, message: "text is required." },
      { status: 400 },
    );
  }

  const translated = body.translated?.trim();
  if (translated) {
    const store = getSessionStore();
    const timestamp = body.timestamp ?? new Date().toISOString();
    store.addTranscript({
      original: text,
      translated,
      detectedLanguage: "unknown",
      timestamp,
    });
    return NextResponse.json({ success: true });
  }

  await submitTranscript(text);
  return NextResponse.json({ success: true });
}
