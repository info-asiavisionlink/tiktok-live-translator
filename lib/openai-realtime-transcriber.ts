import WebSocket from "ws";
import {
  clearPartials,
  finalizeRealtimeTranscript,
  setPartialTranscript,
  setPartialTranslation,
} from "./realtime-transcript-handler";

const REALTIME_TRANSLATE_MODEL = "gpt-realtime-translate";
const REALTIME_TRANSLATIONS_WS_BASE =
  "wss://api.openai.com/v1/realtime/translations";
const OUTPUT_LANGUAGE = "ja";
const CONNECT_TIMEOUT_MS = 15_000;
const FINALIZE_PAUSE_MS = 1_200;

/** OpenAI Realtime translation requires 24 kHz PCM16 mono. */
export const REALTIME_PCM_SAMPLE_RATE = 24_000;

type RealtimeEvent = {
  type?: string;
  delta?: string;
  transcript?: string;
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

function buildTranslationWebSocketUrl(): string {
  const url = new URL(REALTIME_TRANSLATIONS_WS_BASE);
  url.searchParams.set("model", REALTIME_TRANSLATE_MODEL);
  return url.toString();
}

function isSessionReadyEvent(type: string): boolean {
  return (
    type === "session.created" ||
    type === "session.updated" ||
    type === "translation_session.created" ||
    type === "translation_session.updated"
  );
}

export class OpenAiRealtimeTranscriber {
  private ws: WebSocket | null = null;
  private connected = false;
  private closed = false;
  private closingSession = false;
  private inputPartial = "";
  private outputPartial = "";
  private finalizeTimer: ReturnType<typeof setTimeout> | null = null;
  private rejectConnect: ((error: Error) => void) | null = null;

  constructor(private readonly callbacks: RealtimeTranscriberCallbacks = {}) {}

  async connect(): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const wsUrl = buildTranslationWebSocketUrl();
    console.log("[Realtime] Using translation model:", REALTIME_TRANSLATE_MODEL);
    console.log("[Realtime] Output language:", OUTPUT_LANGUAGE);

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
        this.sendTranslationSessionUpdate();
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

  private sendTranslationSessionUpdate(): void {
    this.send({
      type: "session.update",
      session: {
        audio: {
          output: {
            language: OUTPUT_LANGUAGE,
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

  private scheduleFinalize(): void {
    if (this.finalizeTimer) {
      clearTimeout(this.finalizeTimer);
    }

    this.finalizeTimer = setTimeout(() => {
      this.finalizeTimer = null;
      this.commitCurrentTurn();
    }, FINALIZE_PAUSE_MS);
  }

  private commitCurrentTurn(): void {
    const original = this.inputPartial.trim();
    const translated = this.outputPartial.trim();

    if (!original && !translated) {
      return;
    }

    this.inputPartial = "";
    this.outputPartial = "";
    finalizeRealtimeTranscript(original, translated);
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

    if (type === "session.closed") {
      this.connected = false;
      return;
    }

    if (type === "session.input_transcript.delta") {
      this.inputPartial += event.delta ?? "";
      setPartialTranscript(this.inputPartial);
      if (event.delta) {
        console.log("[Realtime] Input transcript:", this.inputPartial);
      }
      this.scheduleFinalize();
      return;
    }

    if (type === "session.output_transcript.delta") {
      this.outputPartial += event.delta ?? "";
      setPartialTranslation(this.outputPartial);
      if (event.delta) {
        console.log("[Realtime] Output translation:", this.outputPartial);
      }
      this.scheduleFinalize();
      return;
    }

    if (
      type === "session.input_transcript.completed" ||
      type === "session.input_transcript.done"
    ) {
      if (event.transcript?.trim()) {
        this.inputPartial = event.transcript.trim();
        setPartialTranscript(this.inputPartial);
      }
      this.commitCurrentTurn();
      return;
    }

    if (
      type === "session.output_transcript.completed" ||
      type === "session.output_transcript.done"
    ) {
      if (event.transcript?.trim()) {
        this.outputPartial = event.transcript.trim();
        setPartialTranslation(this.outputPartial);
      }
      this.commitCurrentTurn();
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
      type: "session.input_audio_buffer.append",
      audio: pcmChunk.toString("base64"),
    });
  }

  disconnect(): void {
    this.closed = true;
    this.connected = false;

    if (this.finalizeTimer) {
      clearTimeout(this.finalizeTimer);
      this.finalizeTimer = null;
    }

    this.commitCurrentTurn();
    this.rejectConnect = null;
    clearPartials();

    if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.closingSession) {
      this.closingSession = true;
      try {
        this.send({ type: "session.close" });
      } catch {
        // ignore
      }
    }

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
