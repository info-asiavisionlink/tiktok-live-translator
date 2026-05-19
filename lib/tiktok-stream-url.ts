import { getActiveConnection } from "./tiktok-connection-registry";

const URL_IN_STRING_PATTERN =
  /https?:\/\/[^\s"'<>\\]+(?:\.m3u8|\.flv|\.mp4|pull-|\/stage\/|\/obj\/|tiktokcdn|tiktokv)[^\s"'<>\\]*/gi;

function normalizeStreamUrl(url: string): string {
  return url.replace(/\\u002F/g, "/").replace(/\\\//g, "/").trim();
}

function scoreStreamUrl(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;

  if (lower.includes(".flv")) score += 50;
  if (lower.includes(".m3u8")) score += 40;
  if (lower.includes(".mp4")) score += 20;
  if (lower.includes("hd") || lower.includes("origin")) score += 15;
  if (lower.includes("pull-f5")) score += 10;
  if (lower.includes("tiktokcdn") || lower.includes("tiktokv")) score += 5;

  return score;
}

function isLikelyStreamUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.startsWith("http") &&
    (lower.includes(".m3u8") ||
      lower.includes(".flv") ||
      lower.includes(".mp4") ||
      lower.includes("pull-") ||
      lower.includes("/stage/") ||
      lower.includes("/obj/") ||
      lower.includes("tiktokcdn") ||
      lower.includes("tiktokv.com"))
  );
}

function collectUrlsFromValue(value: unknown, depth = 0, found: string[] = []): string[] {
  if (depth > 16 || value == null) {
    return found;
  }

  if (typeof value === "string") {
    const normalized = normalizeStreamUrl(value);
    if (isLikelyStreamUrl(normalized)) {
      found.push(normalized);
    }

    const embedded = normalized.match(URL_IN_STRING_PATTERN);
    if (embedded) {
      for (const match of embedded) {
        const cleaned = normalizeStreamUrl(match);
        if (isLikelyStreamUrl(cleaned)) {
          found.push(cleaned);
        }
      }
    }
    return found;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrlsFromValue(item, depth + 1, found);
    }
    return found;
  }

  if (typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectUrlsFromValue(nested, depth + 1, found);
    }
  }

  return found;
}

function pickBestStreamUrl(urls: string[]): string | null {
  const unique = [...new Set(urls)];
  if (unique.length === 0) {
    return null;
  }

  unique.sort((a, b) => scoreStreamUrl(b) - scoreStreamUrl(a));
  return unique[0] ?? null;
}

export function extractStreamUrlFromRoomInfo(roomInfo: unknown): string | null {
  const urls = collectUrlsFromValue(roomInfo);
  return pickBestStreamUrl(urls);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function trySources(
  label: string,
  loader: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const data = await loader();
    const url = extractStreamUrlFromRoomInfo(data);
    if (url) {
      console.info(`[Audio] Stream URL found (${label})`);
      return url;
    }
  } catch (error) {
    console.error(`[Audio] Error: ${label} failed`, error);
  }
  return null;
}

export async function resolveLiveStreamUrl(): Promise<string | null> {
  const connection = getActiveConnection();
  if (!connection) {
    console.error("[Audio] Error: No active TikTok connection");
    return null;
  }

  const sources: Array<{ label: string; loader: () => Promise<unknown> }> = [
    { label: "connection.roomInfo", loader: async () => connection.roomInfo },
    { label: "connection.state", loader: async () => connection.state },
    {
      label: "fetchRoomInfo",
      loader: () => connection.fetchRoomInfo(),
    },
    {
      label: "fetchRoomInfoFromApiLive",
      loader: () =>
        connection.webClient.fetchRoomInfoFromApiLive({
          uniqueId: connection.uniqueId,
        }),
    },
    {
      label: "fetchRoomInfoFromHtml",
      loader: () =>
        connection.webClient.fetchRoomInfoFromHtml({
          uniqueId: connection.uniqueId,
        }),
    },
    {
      label: "fetchRoomInfoFromEuler",
      loader: () =>
        connection.webClient.fetchRoomInfoFromEuler({
          uniqueId: connection.uniqueId,
        }),
    },
  ];

  for (const source of sources) {
    const url = await trySources(source.label, source.loader);
    if (url) {
      return url;
    }
  }

  return null;
}

export async function resolveLiveStreamUrlWithRetry(
  attempts = 6,
  delayMs = 2000,
): Promise<string | null> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const url = await resolveLiveStreamUrl();
    if (url) {
      return url;
    }

    if (attempt < attempts) {
      console.info(
        `[Audio] Stream URL not ready (attempt ${attempt}/${attempts}), retrying...`,
      );
      await sleep(delayMs);
    }
  }

  console.error("[Audio] Error: Could not resolve stream URL after retries");
  return null;
}
