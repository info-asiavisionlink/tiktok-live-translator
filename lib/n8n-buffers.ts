import { sendProcessWebhook } from "./n8n";
import { getSessionStore } from "./session-store";
import type { Comment, Gift } from "./types";

export const COMMENT_BATCH_SIZE = 30;
export const GIFT_BATCH_SIZE = 30;

function toCommentBatchItem(comment: Comment) {
  return {
    username: comment.username,
    text: comment.original,
    timestamp: comment.timestamp ?? new Date().toISOString(),
  };
}

function toGiftBatchItem(gift: Gift) {
  return {
    username: gift.username,
    giftName: gift.giftName,
    count: gift.count,
    repeatCount: gift.repeatCount,
    diamondCount: gift.diamondCount,
    giftId: gift.giftId,
    timestamp: gift.timestamp ?? new Date().toISOString(),
  };
}

export async function flushCommentBuffer(): Promise<void> {
  const store = getSessionStore();
  const items = store.drainCommentBuffer();

  if (items.length === 0) {
    return;
  }

  void sendProcessWebhook({
    type: "comment_batch",
    items: items.map(toCommentBatchItem),
  });

  console.log(`[n8n] Comment batch sent: ${items.length} items`);
}

export async function flushGiftBuffer(): Promise<void> {
  const store = getSessionStore();
  const items = store.drainGiftBuffer();

  if (items.length === 0) {
    return;
  }

  void sendProcessWebhook({
    type: "gift_batch",
    items: items.map(toGiftBatchItem),
  });

  console.log(`[n8n] Gift batch sent: ${items.length} items`);
}

export function bufferComment(comment: Omit<Comment, "id">): Comment {
  const store = getSessionStore();
  const saved = store.addComment(comment);
  store.appendCommentBuffer(saved);

  if (store.getCommentBufferLength() >= COMMENT_BATCH_SIZE) {
    void flushCommentBuffer();
  }

  return saved;
}

export function bufferGift(gift: Omit<Gift, "id">): Gift {
  const store = getSessionStore();
  const saved = store.addGift(gift);
  store.appendGiftBuffer(saved);

  if (store.getGiftBufferLength() >= GIFT_BATCH_SIZE) {
    void flushGiftBuffer();
  }

  return saved;
}

export async function flushAllEventBuffers(): Promise<void> {
  await Promise.all([flushCommentBuffer(), flushGiftBuffer()]);
}
