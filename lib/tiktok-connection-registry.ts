import type { TikTokLiveConnection } from "tiktok-live-connector";

const globalForRegistry = globalThis as typeof globalThis & {
  __tiktokActiveConnection?: TikTokLiveConnection | null;
  __tiktokConnecting?: boolean;
};

export function setActiveConnection(
  connection: TikTokLiveConnection | null,
): void {
  globalForRegistry.__tiktokActiveConnection = connection;
}

export function getActiveConnection(): TikTokLiveConnection | null {
  return globalForRegistry.__tiktokActiveConnection ?? null;
}

export function setConnecting(connecting: boolean): void {
  globalForRegistry.__tiktokConnecting = connecting;
}

export function isConnecting(): boolean {
  return globalForRegistry.__tiktokConnecting === true;
}
