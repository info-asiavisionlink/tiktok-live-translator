import { getActiveConnection } from "./tiktok-connection-registry";

const STREAM_URL_PATTERN =
  /^https?:\/\/.+(\.m3u8|\.flv|pull-|\/stage\/|\/obj\/)/i;

function isStreamUrl(value: string): boolean {
  return STREAM_URL_PATTERN.test(value) || value.includes("tiktokcdn");
}

function findStreamUrlDeep(value: unknown, depth = 0): string | null {
  if (depth > 12 || value == null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return isStreamUrl(trimmed) ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStreamUrlDeep(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    const preferredKeys = [
      "HD1",
      "hd",
      "origin",
      "FULL_HD1",
      "SD1",
      "sd",
      "flv_pull_url",
      "hls_pull_url",
      "rtmp_pull_url",
      "stream_url",
      "data",
    ];

    for (const key of preferredKeys) {
      if (key in record) {
        const found = findStreamUrlDeep(record[key], depth + 1);
        if (found) {
          return found;
        }
      }
    }

    for (const nested of Object.values(record)) {
      const found = findStreamUrlDeep(nested, depth + 1);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export function extractStreamUrlFromRoomInfo(roomInfo: unknown): string | null {
  return findStreamUrlDeep(roomInfo);
}

export async function resolveLiveStreamUrl(): Promise<string | null> {
  const connection = getActiveConnection();
  if (!connection) {
    return null;
  }

  let url = extractStreamUrlFromRoomInfo(connection.roomInfo);
  if (url) {
    return url;
  }

  try {
    const roomInfo = await connection.fetchRoomInfo();
    url = extractStreamUrlFromRoomInfo(roomInfo);
    if (url) {
      return url;
    }
  } catch (error) {
    console.error("[audio] fetchRoomInfo failed:", error);
  }

  try {
    const htmlInfo = await connection.webClient.fetchRoomInfoFromHtml({
      uniqueId: connection.uniqueId,
    });
    url = extractStreamUrlFromRoomInfo(htmlInfo);
  } catch (error) {
    console.error("[audio] fetchRoomInfoFromHtml failed:", error);
  }

  return url;
}
