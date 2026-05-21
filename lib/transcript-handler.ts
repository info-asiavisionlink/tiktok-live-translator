import { getSessionStore } from "./session-store";

/** Whisper fallback: store final text locally; n8n block flush sends batches. */
export async function saveTranscript(original: string): Promise<void> {
  const trimmed = original.trim();
  if (!trimmed) {
    return;
  }

  getSessionStore().addTranscript({
    original: trimmed,
    translated: "",
    detectedLanguage: "auto",
  });
  getSessionStore().appendTranscriptBuffer(trimmed, "");

  console.log("[Transcript] Stored:", trimmed);
}
