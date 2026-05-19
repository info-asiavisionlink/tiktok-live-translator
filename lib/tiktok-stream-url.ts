import { getActiveConnection } from "./tiktok-connection-registry";
import { streamHasAudioStream } from "./stream-probe";

const URL_IN_STRING_PATTERN =
  /https?:\/\/[^\s"'<>\\]+(?:\.m3u8|\.flv|\.mp4|pull-|\/stage\/|\/obj\/|tiktokcdn|tiktokv)[^\s"'<>\\]*/gi;

function normalizeStreamUrl(url: string): string {
  return url.replace(/\\u002F/g, "/").replace(/\\\//g, "/").trim();
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

function streamUrlPriority(url: string): number {
  const lower = url.toLowerCase();
  if (lower.includes(".flv")) {
    return 0;
  }
  if (lower.includes(".m3u8")) {
    return 1;
  }
  return 2;
}

/** FLV first, then HLS (.m3u8), then other fallbacks. */
export function rankStreamCandidateUrls(urls: string[]): string[] {
  const unique = [
    ...new Set(
      urls.map(normalizeStreamUrl).filter((url) => isLikelyStreamUrl(url)),
    ),
  ];

  return unique.sort((a, b) => {
    const priorityDiff = streamUrlPriority(a) - streamUrlPriority(b);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return b.length - a.length;
  });
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

export function extractStreamCandidateUrls(roomInfo: unknown): string[] {
  return rankStreamCandidateUrls(collectUrlsFromValue(roomInfo));
}

/** @deprecated Use extractStreamCandidateUrls */
export function extractStreamUrlFromRoomInfo(roomInfo: unknown): string | null {
  const ranked = extractStreamCandidateUrls(roomInfo);
  return ranked[0] ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function collectAllStreamCandidateUrls(): Promise<string[]> {
  const connection = getActiveConnection();
  if (!connection) {
    console.error("[Audio] Error: No active TikTok connection");
    return [];
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

  const collected: string[] = [];

  for (const source of sources) {
    try {
      const data = await source.loader();
      const urls = extractStreamCandidateUrls(data);
      if (urls.length > 0) {
        console.info(
          `[Audio] Found ${urls.length} candidate URL(s) from ${source.label}`,
        );
        collected.push(...urls);
      }
    } catch (error) {
      console.error(`[Audio] Error: ${source.label} failed`, error);
    }
  }

  return rankStreamCandidateUrls(collected);
}

export async function selectValidatedStreamUrl(
  candidates: string[],
): Promise<string | null> {
  const ranked = rankStreamCandidateUrls(candidates);

  console.log("[Audio] Candidate URLs:", ranked);

  if (ranked.length === 0) {
    console.error("[Audio] No valid audio stream found for this live");
    return null;
  }

  for (const url of ranked) {
    console.log("[Audio] Testing stream URL:", url);

    const hasAudio = await streamHasAudioStream(url);
    if (hasAudio) {
      console.log("[Audio] Audio stream detected");
      console.log("[Audio] Selected stream URL:", url);
      return url;
    }

    console.log("[Audio] No audio stream found");
  }

  console.error("[Audio] No valid audio stream found for this live");
  return null;
}

export async function resolveLiveStreamUrl(): Promise<string | null> {
  const candidates = await collectAllStreamCandidateUrls();
  return selectValidatedStreamUrl(candidates);
}

export async function resolveLiveStreamUrlWithRetry(
  attempts = 6,
  delayMs = 2000,
): Promise<string | null> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const candidates = await collectAllStreamCandidateUrls();

    if (candidates.length > 0) {
      const selected = await selectValidatedStreamUrl(candidates);
      if (selected) {
        return selected;
      }
    }

    if (attempt < attempts) {
      console.info(
        `[Audio] No valid audio stream yet (attempt ${attempt}/${attempts}), retrying...`,
      );
      await sleep(delayMs);
    }
  }

  console.error("[Audio] No valid audio stream found for this live");
  return null;
}
