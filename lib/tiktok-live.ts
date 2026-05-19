import {
  ControlEvent,
  TikTokLiveConnection,
  WebcastEvent,
} from "tiktok-live-connector";
import { stopAudioTranscription } from "./audio-transcriber";
import { sendProcessWebhook } from "./n8n";
import {
  getActiveConnection,
  isConnecting,
  setActiveConnection,
  setConnecting,
} from "./tiktok-connection-registry";
import { getSessionStore } from "./session-store";
import { submitTranscript } from "./transcript-handler";

function getUsername(data: {
  uniqueId?: string;
  user?: { uniqueId?: string; nickname?: string };
}): string {
  return (
    data.uniqueId ??
    data.user?.uniqueId ??
    data.user?.nickname ??
    "unknown"
  );
}

function getGiftName(data: {
  giftName?: string;
  extendedGiftInfo?: { name?: string; diamond_count?: number };
  giftId?: number | string;
}): string {
  return (
    data.giftName ??
    data.extendedGiftInfo?.name ??
    (data.giftId != null ? `Gift #${data.giftId}` : "Gift")
  );
}

function getDiamondCount(data: {
  diamondCount?: number;
  extendedGiftInfo?: { diamond_count?: number; diamondCount?: number };
}): number {
  if (typeof data.diamondCount === "number" && data.diamondCount >= 0) {
    return data.diamondCount;
  }
  const fromInfo = data.extendedGiftInfo;
  if (typeof fromInfo?.diamond_count === "number" && fromInfo.diamond_count >= 0) {
    return fromInfo.diamond_count;
  }
  if (typeof fromInfo?.diamondCount === "number" && fromInfo.diamondCount >= 0) {
    return fromInfo.diamondCount;
  }
  return 0;
}

function extractCaptionText(raw: unknown): string {
  const data = raw as {
    content?: string;
    caption?: string;
    text?: string;
    captionText?: string;
  };
  const candidates = [data.content, data.caption, data.text, data.captionText];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function closeConnection(): void {
  const connection = getActiveConnection();
  if (connection) {
    try {
      connection.removeAllListeners();
      connection.disconnect();
    } catch (error) {
      console.error("[tiktok] Disconnect error:", error);
    }
  }
  setActiveConnection(null);
  setConnecting(false);
}

export { getActiveConnection, isConnecting };

export async function disconnectTikTokLive(): Promise<void> {
  await stopAudioTranscription();
  closeConnection();
  const store = getSessionStore();
  if (store.getSnapshot().status.connectionState === "ended") {
    return;
  }
  store.setConnectionState("disconnected");
}

async function handleStreamEnd(): Promise<void> {
  await stopAudioTranscription();
  const store = getSessionStore();
  store.setConnectionState("ended");
  closeConnection();
}

export async function connectToTikTokLive(username: string): Promise<void> {
  await stopAudioTranscription();
  closeConnection();

  const store = getSessionStore();
  store.startSession(username);

  const connection = new TikTokLiveConnection(username, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    fetchRoomInfoOnConnect: true,
  });

  setActiveConnection(connection);
  setConnecting(true);

  connection.on(ControlEvent.CONNECTED, () => {
    store.setConnectionState("connected");
  });

  connection.on(ControlEvent.DISCONNECTED, async () => {
    await stopAudioTranscription();
    const current = store.getSnapshot().status.connectionState;
    if (current !== "ended") {
      store.setConnectionState("disconnected");
    }
    closeConnection();
  });

  connection.on(WebcastEvent.STREAM_END, () => {
    void handleStreamEnd();
  });

  connection.on(ControlEvent.ERROR, (error: unknown) => {
    console.error("[tiktok] Connection error:", error);
  });

  connection.on(WebcastEvent.ROOM_USER, (raw) => {
    const data = raw as { viewerCount?: number };
    if (typeof data.viewerCount === "number") {
      store.setViewerCount(data.viewerCount);
    }
  });

  connection.on(WebcastEvent.LIKE, (raw) => {
    const data = raw as { likeCount?: number; totalLikeCount?: number };
    if (typeof data.totalLikeCount === "number") {
      store.setTotalLikes(data.totalLikeCount);
    } else if (typeof data.likeCount === "number" && data.likeCount > 0) {
      store.addLikes(data.likeCount);
    }
  });

  connection.on(WebcastEvent.FOLLOW, () => {
    store.incrementFollowCount();
  });

  connection.on(WebcastEvent.CHAT, (raw) => {
    const data = raw as {
      uniqueId?: string;
      user?: { uniqueId?: string; nickname?: string };
      comment?: string;
    };
    const chatUsername = getUsername(data);
    const text =
      typeof data.comment === "string" ? data.comment : String(data.comment ?? "");
    const timestamp = new Date().toISOString();

    store.addComment({
      username: chatUsername,
      original: text,
      timestamp,
    });

    void sendProcessWebhook({
      type: "comment",
      username: chatUsername,
      text,
      timestamp,
    });
  });

  connection.on(WebcastEvent.GIFT, (raw) => {
    const data = raw as unknown as {
      uniqueId?: string;
      user?: { uniqueId?: string; nickname?: string };
      giftName?: string;
      extendedGiftInfo?: { name?: string; diamond_count?: number; diamondCount?: number };
      giftId?: number | string;
      giftType?: number;
      repeatEnd?: boolean;
      repeatCount?: number;
      diamondCount?: number;
    };

    if (data.giftType === 1 && !data.repeatEnd) {
      return;
    }

    const giftUsername = getUsername(data);
    const giftName = getGiftName(data);
    const repeatCount =
      typeof data.repeatCount === "number" && data.repeatCount > 0
        ? data.repeatCount
        : 1;
    const diamondCount = getDiamondCount(data);
    const giftId = data.giftId ?? null;
    const timestamp = new Date().toISOString();

    store.addGift({
      username: giftUsername,
      giftName,
      count: repeatCount,
      repeatCount,
      diamondCount,
      giftId,
      timestamp,
    });

    void sendProcessWebhook({
      type: "gift",
      username: giftUsername,
      giftName,
      count: repeatCount,
      repeatCount,
      diamondCount,
      giftId,
      timestamp,
    });
  });

  connection.on(WebcastEvent.CAPTION_MESSAGE, (raw) => {
    const text = extractCaptionText(raw);
    if (text) {
      void submitTranscript(text);
    }
  });

  try {
    const isLive = await connection.fetchIsLive();
    if (!isLive) {
      throw new Error("LIVE_NOT_FOUND");
    }

    await connection.connect();
    store.setConnectionState("connected");
  } finally {
    setConnecting(false);
  }
}
