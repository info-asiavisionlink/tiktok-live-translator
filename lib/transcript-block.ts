const THREE_MINUTE_MS = 3 * 60 * 1000;
const FIVE_MINUTE_MS = 5 * 60 * 1000;

export interface TranscriptTimeBlock {
  blockStart: string;
  blockEnd: string;
}

function getTimeBlock(blockMs: number, at: Date | string = new Date()): TranscriptTimeBlock {
  const date = typeof at === "string" ? new Date(at) : at;
  const time = date.getTime();
  const blockStartMs = Math.floor(time / blockMs) * blockMs;
  const blockEndMs = blockStartMs + blockMs - 1;

  return {
    blockStart: new Date(blockStartMs).toISOString(),
    blockEnd: new Date(blockEndMs).toISOString(),
  };
}

/** UTC 3-minute window for n8n transcript_block payloads. */
export function getThreeMinuteBlock(at: Date | string = new Date()): TranscriptTimeBlock {
  return getTimeBlock(THREE_MINUTE_MS, at);
}

/** @deprecated Use getThreeMinuteBlock for n8n blocks */
export function getFiveMinuteBlock(at: Date | string = new Date()): TranscriptTimeBlock {
  return getTimeBlock(FIVE_MINUTE_MS, at);
}
