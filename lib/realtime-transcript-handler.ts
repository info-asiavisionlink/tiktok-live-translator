import { sendProcessWebhook } from "./n8n";
import { getSessionStore } from "./session-store";
import { getThreeMinuteBlock } from "./transcript-block";

export function setPartialTranscript(text: string): void {
  getSessionStore().setCurrentPartialTranscript(text);
}

export function setPartialTranslation(text: string): void {
  getSessionStore().setCurrentPartialTranslation(text);
}

export function clearPartials(): void {
  const store = getSessionStore();
  store.setCurrentPartialTranscript("");
  store.setCurrentPartialTranslation("");
}

export function finalizeRealtimeTranscript(
  original: string,
  translated: string,
): void {
  const trimmedOriginal = original.trim();
  const trimmedTranslated = translated.trim();

  if (!trimmedOriginal && !trimmedTranslated) {
    clearPartials();
    return;
  }

  clearPartials();

  getSessionStore().addTranscript({
    original: trimmedOriginal,
    translated: trimmedTranslated,
    detectedLanguage: "auto",
  });
  getSessionStore().appendTranscriptBuffer(trimmedOriginal, trimmedTranslated);

  console.log("[Realtime] Final transcript:", trimmedOriginal);
  if (trimmedTranslated) {
    console.log("[Realtime] Final translation:", trimmedTranslated);
  }
}

export async function flushTranscriptBlock(): Promise<void> {
  const store = getSessionStore();
  const entries = store.drainTranscriptBuffer();

  if (entries.length === 0) {
    return;
  }

  const text = entries.map((entry) => entry.original).join("\n");
  const translated = entries.map((entry) => entry.translated).join("\n");
  const { blockStart, blockEnd } = getThreeMinuteBlock();

  void sendProcessWebhook({
    type: "transcript_block",
    text,
    translated,
    blockStart,
    blockEnd,
  });

  store.clearDisplayTranscripts();

  console.log("[Realtime] 3-minute block sent");
}
