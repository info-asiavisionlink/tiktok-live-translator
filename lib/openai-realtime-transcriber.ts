import WebSocket from "ws";
import {
  finalizeRealtimeTranscript,
  setPartialTranscript,
} from "./realtime-transcript-handler";

const REALTIME_SESSION_MODEL = "gpt-realtime-1.5";
const REALTIME_TRANSCRIPTION_MODEL = "gpt-realtime-whisper";
const REALTIME_GA_WS_BASE = "wss://api.openai.com/v1/realtime";
const CONNECT_TIMEOUT_MS = 15_000;

/** OpenAI Realtime GA transcription requires 24 kHz PCM16 mono. */
export const REALTIME_PCM_SAMPLE_RATE = 24_000;

type RealtimeEvent = {
  type?: string;
  delta?: string;
  transcript?: string;
  item_id?: string;
  error?: {
    type?: string;
    message?: string;
    code?: string;
  };
};

export interface RealtimeTranscriberCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
}

function buildRealtimeWebSocketUrl(): string {
  const url = new URL(REALTIME_GA_WS_BASE);
  url.searchParams.set("model", REALTIME_SESSION_MODEL);
  return url.toString();
}

function isSessionReadyEvent(type: string): boolean {
  return (
    type === "session.created" ||
    type === "session.updated" ||
    type === "transcription_session.created" ||
    type === "transcription_session.updated"
  );
}

export class OpenAiRealtimeTranscriber {
  private ws: WebSocket | null = null;
  private connected = false;
  private closed = false;
  private readonly partialByItem = new Map<string, string>();
  private activeItemId: string | null = null;
  private rejectConnect: ((error: Error) => void) | null = null;

  constructor(private readonly callbacks: RealtimeTranscriberCallbacks = {}) {}

  async connect(): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const wsUrl = buildRealtimeWebSocketUrl();
    console.log("[Realtime] Using session model:", REALTIME_SESSION_MODEL);
    console.log("[Realtime] Using transcription model:", REALTIME_TRANSCRIPTION_MODEL);

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const markReady = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        this.rejectConnect = null;
        if (!this.connected) {
          this.connected = true;
          console.log("[Realtime] Connected");
          this.callbacks.onConnected?.();
        }
        resolve();
      };

      const failConnect = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        this.rejectConnect = null;
        reject(error);
      };

      this.rejectConnect = failConnect;

      const timeout = setTimeout(() => {
        failConnect(new Error("Realtime connection timed out"));
      }, CONNECT_TIMEOUT_MS);

      this.ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      this.ws.on("open", () => {
        this.sendTranscriptionSessionUpdate();
      });

      this.ws.on("message", (data) => {
        try {
          const event = JSON.parse(data.toString()) as RealtimeEvent;
          this.handleEvent(event, markReady, failConnect);
        } catch (error) {
          console.error("[Realtime] Error: Failed to parse event", error);
        }
      });

      this.ws.on("error", (error) => {
        clearTimeout(timeout);
        const message =
          error instanceof Error ? error.message : "WebSocket error";
        console.error("[Realtime] Error:", message);
        failConnect(error instanceof Error ? error : new Error(message));
      });

      this.ws.on("close", (code, reason) => {
        this.connected = false;
        if (!this.closed && !settled) {
          const reasonText = reason.toString() || "connection closed";
          failConnect(
            new Error(`Realtime WebSocket closed (${code}): ${reasonText}`),
          );
        }
        if (!this.closed) {
          console.log("[Realtime] Disconnected");
        }
        this.callbacks.onDisconnected?.();
      });
    });
  }

  /** GA Realtime API: realtime session + dedicated input transcription model. */
  private sendTranscriptionSessionUpdate(): void {
    this.send({
      type: "session.update",
      session: {
        type: "realtime",
        modalities: ["audio", "text"],
        audio: {
          input: {
            format: {
              type: "audio/pcm",
              rate: REALTIME_PCM_SAMPLE_RATE,
            },
            transcription: {
              model: REALTIME_TRANSCRIPTION_MODEL,
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
        },
      },
    });
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(payload));
  }

  private handleEvent(
    event: RealtimeEvent,
    onReady: () => void,
    onFatalError: (error: Error) => void,
  ): void {
    const type = event.type ?? "";

    if (type === "error") {
      const message = event.error?.message ?? "Unknown Realtime API error";
      console.error("[Realtime] Error:", message);
      if (!this.connected) {
        onFatalError(new Error(message));
      }
      return;
    }

    if (isSessionReadyEvent(type)) {
      onReady();
      return;
    }

    if (type === "conversation.item.input_audio_transcription.delta") {
      const itemId = event.item_id ?? "default";
      const previous = this.partialByItem.get(itemId) ?? "";
      const next = previous + (event.delta ?? "");
      this.partialByItem.set(itemId, next);
      this.activeItemId = itemId;
      setPartialTranscript(next);
      if (event.delta) {
        console.log("[Realtime] Partial transcript:", next);
      }
      return;
    }

    if (type === "conversation.item.input_audio_transcription.completed") {
      const itemId = event.item_id ?? "default";
      const transcript =
        event.transcript?.trim() || this.partialByItem.get(itemId)?.trim() || "";

      this.partialByItem.delete(itemId);
      if (this.activeItemId === itemId) {
        this.activeItemId = null;
        setPartialTranscript("");
      }

      if (transcript) {
        finalizeRealtimeTranscript(transcript);
      }
    }
  }

  appendAudio(pcmChunk: Buffer): void {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (pcmChunk.length === 0) {
      return;
    }

    this.send({
      type: "input_audio_buffer.append",
      audio: pcmChunk.toString("base64"),
    });
  }

  disconnect(): void {
    this.closed = true;
    this.connected = false;
    this.partialByItem.clear();
    this.activeItemId = null;
    this.rejectConnect = null;
    setPartialTranscript("");

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    console.log("[Realtime] Disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }
}
