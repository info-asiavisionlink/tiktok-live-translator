import { sendProcessWebhook } from "./n8n";
import { getSessionStore } from "./session-store";

export async function submitTranscript(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  const store = getSessionStore();
  const timestamp = new Date().toISOString();

  const transcript = store.addTranscript({
    original: trimmed,
    translated: trimmed,
    detectedLanguage: "unknown",
    timestamp,
  });

  const response = await sendProcessWebhook({
    type: "transcript",
    text: trimmed,
    timestamp,
  });

  if (typeof response?.translated === "string" && response.translated.length > 0) {
    store.updateTranscriptTranslation(transcript.id, response.translated);
  }
}
