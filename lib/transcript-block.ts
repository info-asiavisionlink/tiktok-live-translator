const BLOCK_MS = 5 * 60 * 1000;

export interface FiveMinuteBlock {
  blockStart: string;
  blockEnd: string;
}

/** UTC 5-minute window (e.g. 12:00:00.000Z–12:04:59.999Z). */
export function getFiveMinuteBlock(at: Date | string = new Date()): FiveMinuteBlock {
  const date = typeof at === "string" ? new Date(at) : at;
  const time = date.getTime();
  const blockStartMs = Math.floor(time / BLOCK_MS) * BLOCK_MS;
  const blockEndMs = blockStartMs + BLOCK_MS - 1;

  return {
    blockStart: new Date(blockStartMs).toISOString(),
    blockEnd: new Date(blockEndMs).toISOString(),
  };
}
