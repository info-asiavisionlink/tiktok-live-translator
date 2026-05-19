import {
  ControlEvent,
  TikTokLiveConnection,
  WebcastEvent,
} from "tiktok-live-connector";
import { sendProcessWebhook } from "./n8n";
import { getSessionStore } from "./session-store";

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
  extendedGiftInfo?: { name?: string };
  giftId?: number | string;
}): string {
  return (
    data.giftName ??
    data.extendedGiftInfo?.name ??
    (data.giftId != null ? `Gift #${data.giftId}` : "Gift")
  );
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

    const comment = store.addComment({
      username: chatUsername,
      original: text,
      translated: text,
      timestamp,
    });

    void sendProcessWebhook({
      type: "comment",
      username: chatUsername,
      text,
      timestamp,
    }).then((response) => {
      const translated =
        typeof response?.translated === "string"
          ? response.translated
          : typeof response?.translation === "string"
            ? response.translation
            : null;

      if (translated) {
        store.updateCommentTranslation(comment.id, translated);
      }

      if (response?.transcript && typeof response.transcript === "object") {
        const t = response.transcript as Record<string, unknown>;
        if (
          typeof t.original === "string" &&
          typeof t.translated === "string"
        ) {
          const transcriptTimestamp =
            typeof t.timestamp === "string" ? t.timestamp : timestamp;
          const detectedLanguage =
            typeof t.detectedLanguage === "string"
              ? t.detectedLanguage
              : "unknown";

          store.addTranscript({
            original: t.original,
            translated: t.translated,
            detectedLanguage,
            timestamp: transcriptTimestamp,
          });

          void sendProcessWebhook({
            type: "transcript",
            original: t.original,
            translated: t.translated,
            detectedLanguage,
            timestamp: transcriptTimestamp,
          });
        }
      }
    });
  });

  connection.on(WebcastEvent.GIFT, (raw) => {
    const data = raw as unknown as {
      uniqueId?: string;
      user?: { uniqueId?: string; nickname?: string };
      giftName?: string;
      extendedGiftInfo?: { name?: string };
      giftId?: number | string;
      giftType?: number;
      repeatEnd?: boolean;
      repeatCount?: number;
    };

    if (data.giftType === 1 && !data.repeatEnd) {
      return;
    }

    const giftUsername = getUsername(data);
    const giftName = getGiftName(data);
    const count =
      typeof data.repeatCount === "number" && data.repeatCount > 0
        ? data.repeatCount
        : 1;
    const timestamp = new Date().toISOString();

    store.addGift({
      username: giftUsername,
      giftName,
      count,
      timestamp,
    });

    void sendProcessWebhook({
      type: "gift",
      username: giftUsername,
      giftName,
      count,
      timestamp,
    });
  });

  connection.on(WebcastEvent.MEMBER, (data) => {
    const memberUsername = getUsername(data);
    store.addMember(memberUsername);

    void sendProcessWebhook({
      type: "member",
      username: memberUsername,
      timestamp: new Date().toISOString(),
    });
  });

  connection.on(WebcastEvent.LIKE, (raw) => {
    const data = raw as { likeCount?: number };
    const likeCount =
      typeof data.likeCount === "number" && data.likeCount > 0
        ? data.likeCount
        : 1;
    store.addLike(likeCount);
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
