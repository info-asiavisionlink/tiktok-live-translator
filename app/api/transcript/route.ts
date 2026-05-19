import { NextResponse } from "next/server";
import { submitTranscript } from "@/lib/transcript-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TranscriptRequestBody {
  text?: string;
  timestamp?: string;
}

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

  await submitTranscript(text);
  return NextResponse.json({ success: true });
}
