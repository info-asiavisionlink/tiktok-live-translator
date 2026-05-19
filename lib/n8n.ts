type N8nPayload = Record<string, unknown>;

/** Development fallback for session-start webhook */
export const DEV_N8N_WEBHOOK_URL =
  "https://nextasia.app.n8n.cloud/webhook/8a64212f-6788-4811-9e79-04e304162749";

/** Development fallback for process webhook (session_start, comment, gift, transcript) */
export const DEV_N8N_PROCESS_WEBHOOK_URL =
  "https://nextasia.app.n8n.cloud/webhook/8a64212f-6788-4811-9e79-04e304162749";

export function getSessionStartWebhookUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "development") {
    return DEV_N8N_WEBHOOK_URL;
  }
  return "";
}

export function getProcessWebhookUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_N8N_PROCESS_WEBHOOK_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "development") {
    return DEV_N8N_PROCESS_WEBHOOK_URL;
  }
  return "";
}

async function postToWebhook(
  webhookUrl: string,
  payload: N8nPayload,
  label: "session" | "process",
  parseJsonResponse: boolean,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        `[n8n:${label}] Webhook returned ${response.status} ${response.statusText}`,
        { type: payload.type },
      );
      return null;
    }

    if (!parseJsonResponse) {
      return { success: true };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as Record<string, unknown>;
    }

    return { success: true };
  } catch (error) {
    console.error(`[n8n:${label}] Webhook request failed:`, error, {
      type: payload.type,
    });
    return null;
  }
}

/** Session start only — NEXT_PUBLIC_N8N_WEBHOOK_URL */
export async function sendSessionStartWebhook(
  payload: N8nPayload,
): Promise<void> {
  const webhookUrl = getSessionStartWebhookUrl();
  if (!webhookUrl) {
    console.error(
      "[n8n:session] Webhook URL is not configured. Set NEXT_PUBLIC_N8N_WEBHOOK_URL.",
    );
    return;
  }
  await postToWebhook(webhookUrl, payload, "session", false);
}

/** Event processing — NEXT_PUBLIC_N8N_PROCESS_WEBHOOK_URL */
export async function sendProcessWebhook(
  payload: N8nPayload,
): Promise<Record<string, unknown> | null> {
  const webhookUrl = getProcessWebhookUrl();
  if (!webhookUrl) {
    console.error(
      "[n8n:process] Webhook URL is not configured. Set NEXT_PUBLIC_N8N_PROCESS_WEBHOOK_URL.",
    );
    return null;
  }

  return postToWebhook(webhookUrl, payload, "process", false);
}
