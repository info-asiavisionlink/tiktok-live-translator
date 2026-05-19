import { normalizeTikTokUrl } from "./validate";

export function extractUsernameFromUrl(input: string): string | null {
  try {
    const url = new URL(normalizeTikTokUrl(input));
    const match = url.pathname.match(/@([^/?#]+)/i);
    if (!match?.[1]) {
      return null;
    }
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
