const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

const TRANSLATION_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "You are a professional translator. Translate the input into natural Japanese. Return only the translated text.";

export async function translateToJapanese(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return "";
  }

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TRANSLATION_MODEL,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
      }),
    });

    if (!response.ok) {
      console.error(
        `[openai] Translation failed: ${response.status} ${response.statusText}`,
      );
      return "";
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    return content ?? "";
  } catch (error) {
    console.error("[openai] Translation request failed:", error);
    return "";
  }
}
