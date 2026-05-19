import type { ApiResponse } from "./types";

export class WebhookError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "WebhookError";
  }
}

export async function startTranslation(url: string): Promise<ApiResponse> {
  const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new WebhookError(
      "Webhook URL is not configured. Set NEXT_PUBLIC_N8N_WEBHOOK_URL in your environment.",
    );
  }

  let response: Response;

  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new WebhookError(
      "Failed to reach the translation service. Check your network connection and webhook URL.",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  let payload: ApiResponse | null = null;

  if (isJson) {
    try {
      payload = (await response.json()) as ApiResponse;
    } catch {
      throw new WebhookError(
        "The translation service returned invalid JSON.",
        response.status,
      );
    }
  }

  if (!response.ok) {
    const message =
      payload?.message ??
      `Translation service error (${response.status} ${response.statusText})`;
    throw new WebhookError(message, response.status);
  }

  if (payload && typeof payload.success === "boolean" && !payload.success) {
    throw new WebhookError(
      payload.message ?? "The translation service rejected the request.",
      response.status,
    );
  }

  return (
    payload ?? {
      success: true,
      useMockData: true,
    }
  );
}
