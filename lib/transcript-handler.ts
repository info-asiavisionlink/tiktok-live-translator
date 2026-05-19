import { sendProcessWebhook } from "./n8n";
import { translateToJapanese } from "./openai-translate";
import { getSessionStore } from "./session-store";

export async function saveTranscript(
  original: string,
  translated?: string,
): Promise<void> {
  const trimmed = original.trim();
  if (!trimmed) {
    return;
  }

  const finalTranslated =
    translated !== undefined ? translated : await translateToJapanese(trimmed);

  if (finalTranslated) {
    console.info("[Audio] Translation success");
  }

  const timestamp = new Date().toISOString();

  getSessionStore().addTranscript({
    original: trimmed,
    translated: finalTranslated,
    detectedLanguage: "unknown",
    timestamp,
  });

  console.log("[Transcript] Stored:", trimmed);

  void sendProcessWebhook({
    type: "transcript",
    text: trimmed,
    translated: finalTranslated,
    timestamp,
  });
}
