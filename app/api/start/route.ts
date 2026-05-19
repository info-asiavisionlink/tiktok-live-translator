import { NextResponse } from "next/server";
import { extractUsernameFromUrl } from "@/lib/extract-username";
import { sendProcessWebhook, sendSessionStartWebhook } from "@/lib/n8n";
import { getSessionStore } from "@/lib/session-store";
import {
  connectToTikTokLive,
  disconnectTikTokLive,
  isConnecting,
} from "@/lib/tiktok-live";
import { isValidTikTokLiveUrl } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StartRequestBody {
  url?: string;
}

function connectionErrorMessage(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof Error) {
    if (error.message === "LIVE_NOT_FOUND") {
      return {
        status: 404,
        message: "This user is not currently live. Please check the URL and try again.",
      };
    }

    const lower = error.message.toLowerCase();
    if (
      lower.includes("not live") ||
      lower.includes("offline") ||
      lower.includes("room id") ||
      lower.includes("not found")
    ) {
      return {
        status: 404,
        message: "Live stream not found. The user may be offline or the URL is incorrect.",
      };
    }

    if (lower.includes("rate limit") || lower.includes("blocked")) {
      return {
        status: 503,
        message: "TikTok connection was rate-limited. Please try again in a few minutes.",
      };
    }
  }

  return {
    status: 500,
    message: "Failed to connect to TikTok Live. Please try again.",
  };
}

export async function POST(request: Request) {
  let body: StartRequestBody;

  try {
    body = (await request.json()) as StartRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json(
      { success: false, message: "URL is required." },
      { status: 400 },
    );
  }

  if (!isValidTikTokLiveUrl(url)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Invalid TikTok Live URL. Example: https://www.tiktok.com/@username/live",
      },
      { status: 400 },
    );
  }

  const username = extractUsernameFromUrl(url);
  if (!username) {
    return NextResponse.json(
      {
        success: false,
        message: "Could not extract username from URL.",
      },
      { status: 400 },
    );
  }

  if (isConnecting()) {
    return NextResponse.json(
      { success: false, message: "A connection is already in progress." },
      { status: 409 },
    );
  }

  try {
    await connectToTikTokLive(username);

    const snapshot = getSessionStore().getSnapshot();
    if (snapshot.status.connectionState !== "connected") {
      await disconnectTikTokLive();
      return NextResponse.json(
        {
          success: false,
          message: "Connected to TikTok but the live session is not active.",
        },
        { status: 404 },
      );
    }

    const sessionStartPayload = {
      type: "session_start",
      url,
      username,
      timestamp: new Date().toISOString(),
    };

    void sendSessionStartWebhook(sessionStartPayload);
    void sendProcessWebhook(sessionStartPayload);

    return NextResponse.json({
      success: true,
      username,
    });
  } catch (error) {
    await disconnectTikTokLive();
    getSessionStore().reset();

    const { status, message } = connectionErrorMessage(error);
    return NextResponse.json({ success: false, message }, { status });
  }
}
