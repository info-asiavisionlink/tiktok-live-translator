const TIKTOK_HOST_PATTERN =
  /^(https?:\/\/)?([\w-]+\.)?tiktok\.com(\/|$)/i;

export function isValidTikTokLiveUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);

    if (!TIKTOK_HOST_PATTERN.test(url.origin + "/")) {
      return false;
    }

    const path = url.pathname.toLowerCase();
    return (
      path.includes("/live") ||
      path.includes("@") ||
      url.searchParams.has("unique_id") ||
      url.hostname.includes("tiktok.com")
    );
  } catch {
    return false;
  }
}

export function normalizeTikTokUrl(input: string): string {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return new URL(withProtocol).toString();
}
