import fs from "fs";

const WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";
const WHISPER_MODEL = "whisper-1";

export async function transcribeAudioFile(filePath: string): Promise<string> {
  const apiKey =
    process.env.WHISPER_API_KEY?.trim() ?? process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "[Audio] Error: WHISPER_API_KEY (or OPENAI_API_KEY) is not configured",
    );
    return "";
  }

  let buffer: Buffer;
  try {
    buffer = await fs.promises.readFile(filePath);
  } catch (error) {
    console.error("[Audio] Error: Failed to read audio chunk", error);
    return "";
  }

  if (buffer.length === 0) {
    return "";
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "audio/mpeg" }),
    "chunk.mp3",
  );
  form.append("model", WHISPER_MODEL);

  try {
    const response = await fetch(WHISPER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      console.error(
        `[Audio] Error: Whisper API ${response.status} ${response.statusText}`,
      );
      return "";
    }

    const data = (await response.json()) as { text?: string };
    const text = data.text?.trim() ?? "";

    if (text) {
      console.info("[Audio] Whisper transcription success");
    }

    return text;
  } catch (error) {
    console.error("[Audio] Error: Whisper request failed", error);
    return "";
  }
}
