import { sendProcessWebhook } from "./n8n";
import { getSessionStore } from "./session-store";

export async function submitTranscript(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  const store = getSessionStore();
  const timestamp = new Date().toISOString();

  store.addTranscript({
    original: trimmed,
    translated: "",
    detectedLanguage: "unknown",
    timestamp,
  });

  void sendProcessWebhook({
    type: "transcript",
    text: trimmed,
    timestamp,
  });
}
