import { sendProcessWebhook } from "./n8n";
import { translateToJapanese } from "./openai-translate";
import { getSessionStore } from "./session-store";

export async function submitTranscript(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  const translated = await translateToJapanese(trimmed);
  const timestamp = new Date().toISOString();

  getSessionStore().addTranscript({
    original: trimmed,
    translated,
    detectedLanguage: "unknown",
    timestamp,
  });

  void sendProcessWebhook({
    type: "transcript",
    text: trimmed,
    timestamp,
  });
}
