import { NextResponse } from "next/server";
import { saveTranscript } from "@/lib/transcript-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TranscriptRequestBody {
  text?: string;
  translated?: string;
}

/** Ingest transcript from external pipeline (not CAPTION_MESSAGE) */
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

  await saveTranscript(text, body.translated?.trim());

  return NextResponse.json({ success: true });
}
