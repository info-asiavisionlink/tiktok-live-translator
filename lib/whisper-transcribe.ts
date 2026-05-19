import fs from "fs";

const WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";
const WHISPER_MODEL = "whisper-1";

export async function transcribeAudioFile(filePath: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return "";
  }

  let buffer: Buffer;
  try {
    buffer = await fs.promises.readFile(filePath);
  } catch (error) {
    console.error("[whisper] Failed to read audio file:", error);
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
        `[whisper] API error: ${response.status} ${response.statusText}`,
      );
      return "";
    }

    const data = (await response.json()) as { text?: string };
    return data.text?.trim() ?? "";
  } catch (error) {
    console.error("[whisper] Transcription request failed:", error);
    return "";
  }
}
