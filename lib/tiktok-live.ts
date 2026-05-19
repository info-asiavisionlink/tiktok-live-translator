import {
  ControlEvent,
  TikTokLiveConnection,
  WebcastEvent,
} from "tiktok-live-connector";
import { sendProcessWebhook } from "./n8n";
import { getSessionStore } from "./session-store";
import { submitTranscript } from "./transcript-handler";

const globalForConnection = globalThis as typeof globalThis & {
  __tiktokLiveConnection?: TikTokLiveConnection | null;
  __tiktokConnecting?: boolean;
};

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

export function getActiveConnection(): TikTokLiveConnection | null {
  return globalForConnection.__tiktokLiveConnection ?? null;
}

export function isConnecting(): boolean {
  return globalForConnection.__tiktokConnecting === true;
}

export async function disconnectTikTokLive(): Promise<void> {
  const connection = globalForConnection.__tiktokLiveConnection;
  if (connection) {
    try {
      connection.removeAllListeners();
      connection.disconnect();
    } catch (error) {
      console.error("[tiktok] Disconnect error:", error);
    }
  }
  globalForConnection.__tiktokLiveConnection = null;
  globalForConnection.__tiktokConnecting = false;
  getSessionStore().setConnected(false);
}

export async function connectToTikTokLive(username: string): Promise<void> {
  await disconnectTikTokLive();

  const store = getSessionStore();
  store.startSession(username);

  const connection = new TikTokLiveConnection(username, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    fetchRoomInfoOnConnect: true,
  });

  globalForConnection.__tiktokLiveConnection = connection;
  globalForConnection.__tiktokConnecting = true;

  connection.on(ControlEvent.CONNECTED, () => {
    store.setConnected(true);
  });

  connection.on(ControlEvent.DISCONNECTED, () => {
    store.setConnected(false);
  });

  connection.on(WebcastEvent.STREAM_END, () => {
    store.setConnected(false);
  });

  connection.on(ControlEvent.ERROR, (error: unknown) => {
    console.error("[tiktok] Connection error:", error);
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
    store.setConnected(true);
  } finally {
    globalForConnection.__tiktokConnecting = false;
  }
}
