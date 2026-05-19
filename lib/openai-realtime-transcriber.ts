import WebSocket from "ws";
import {
  finalizeRealtimeTranscript,
  setPartialTranscript,
} from "./realtime-transcript-handler";

const REALTIME_MODEL = "gpt-realtime-whisper";
const REALTIME_WS_URL = `wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`;
const CONNECT_TIMEOUT_MS = 15_000;

/** OpenAI Realtime transcription requires 24 kHz PCM16 mono. */
export const REALTIME_PCM_SAMPLE_RATE = 24_000;

type RealtimeEvent = {
  type?: string;
  delta?: string;
  transcript?: string;
  item_id?: string;
  error?: { message?: string };
};

export interface RealtimeTranscriberCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export class OpenAiRealtimeTranscriber {
  private ws: WebSocket | null = null;
  private connected = false;
  private closed = false;
  private readonly partialByItem = new Map<string, string>();
  private activeItemId: string | null = null;

  constructor(private readonly callbacks: RealtimeTranscriberCallbacks = {}) {}

  async connect(): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const markReady = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        if (!this.connected) {
          this.connected = true;
          console.log("[Realtime] Connected");
          this.callbacks.onConnected?.();
        }
        resolve();
      };

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("Realtime connection timed out"));
        }
      }, CONNECT_TIMEOUT_MS);

      this.ws = new WebSocket(REALTIME_WS_URL, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      this.ws.on("open", () => {
        this.sendSessionUpdate();
      });

      this.ws.on("message", (data) => {
        try {
          const event = JSON.parse(data.toString()) as RealtimeEvent;
          this.handleEvent(event, markReady);
        } catch (error) {
          console.error("[Realtime] Error: Failed to parse event", error);
        }
      });

      this.ws.on("error", (error) => {
        clearTimeout(timeout);
        console.error("[Realtime] Error:", error);
        reject(error);
      });

      this.ws.on("close", () => {
        this.connected = false;
        if (!this.closed) {
          console.log("[Realtime] Disconnected");
        }
        this.callbacks.onDisconnected?.();
      });
    });
  }

  private sendSessionUpdate(): void {
    this.send({
      type: "session.update",
      session: {
        type: "transcription",
        audio: {
          input: {
            format: {
              type: "audio/pcm",
              rate: REALTIME_PCM_SAMPLE_RATE,
            },
            transcription: {
              model: REALTIME_MODEL,
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

  private handleEvent(event: RealtimeEvent, onReady: () => void): void {
    const type = event.type ?? "";

    if (type === "error") {
      console.error("[Realtime] Error:", event.error?.message ?? "Unknown error");
      return;
    }

    if (
      type === "session.created" ||
      type === "session.updated" ||
      type === "transcription_session.updated"
    ) {
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
