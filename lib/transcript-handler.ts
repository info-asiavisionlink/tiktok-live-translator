import { sendProcessWebhook } from "./n8n";
import { getSessionStore } from "./session-store";
import { getFiveMinuteBlock } from "./transcript-block";

export async function saveTranscript(original: string): Promise<void> {
  const trimmed = original.trim();
  if (!trimmed) {
    return;
  }

  const timestamp = new Date().toISOString();
  const { blockStart, blockEnd } = getFiveMinuteBlock(timestamp);

  getSessionStore().addTranscript({
    original: trimmed,
    translated: "",
    detectedLanguage: "auto",
    timestamp,
  });

  console.log("[Transcript] Stored:", trimmed);

  void sendProcessWebhook({
    type: "transcript",
    text: trimmed,
    language: "auto",
    timestamp,
    blockStart,
    blockEnd,
  });
}
