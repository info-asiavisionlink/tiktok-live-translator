import type { SessionData, StartApiResponse, Transcript } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface SessionPollResponse extends SessionData {
  success: boolean;
  transcript?: Transcript | null;
}

export async function startLiveSession(url: string): Promise<StartApiResponse> {
  let response: Response;

  try {
    response = await fetch("/api/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new ApiError(
      "サーバーに接続できませんでした。開発サーバーが起動しているか確認してください。",
    );
  }

  let payload: StartApiResponse & { message?: string };
  try {
    payload = (await response.json()) as StartApiResponse & {
      message?: string;
    };
  } catch {
    throw new ApiError("サーバーから無効な応答が返されました。", response.status);
  }

  if (!response.ok || !payload.success) {
    throw new ApiError(
      payload.message ?? `接続に失敗しました (${response.status})`,
      response.status,
    );
  }

  return payload;
}

export async function fetchSession(): Promise<SessionPollResponse> {
  const response = await fetch("/api/session", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError("セッションデータの取得に失敗しました。", response.status);
  }

  return (await response.json()) as SessionPollResponse;
}

export async function stopLiveSession(): Promise<void> {
  await fetch("/api/stop", {
    method: "POST",
    headers: { Accept: "application/json" },
  });
}
