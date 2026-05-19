import { sendProcessWebhook } from "./n8n";
import { getSessionStore } from "./session-store";
import { getThreeMinuteBlock } from "./transcript-block";

export function setPartialTranscript(text: string): void {
  getSessionStore().setCurrentPartialTranscript(text);
}

export function finalizeRealtimeTranscript(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) {
    getSessionStore().setCurrentPartialTranscript("");
    return;
  }

  getSessionStore().setCurrentPartialTranscript("");
  getSessionStore().addTranscript({
    original: trimmed,
    translated: "",
    detectedLanguage: "auto",
  });
  getSessionStore().appendTranscriptBuffer(trimmed);

  console.log("[Realtime] Final transcript:", trimmed);
}

export async function flushTranscriptBlock(): Promise<void> {
  const store = getSessionStore();
  const lines = store.drainTranscriptBuffer();

  if (lines.length === 0) {
    return;
  }

  const text = lines.join("\n");
  const { blockStart, blockEnd } = getThreeMinuteBlock();

  void sendProcessWebhook({
    type: "transcript_block",
    text,
    blockStart,
    blockEnd,
  });

  store.clearDisplayTranscripts();

  console.log("[Realtime] 3-minute block sent");
}
