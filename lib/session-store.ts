import type {
  Comment,
  ConnectionState,
  Gift,
  SessionData,
  SessionStatus,
  Transcript,
} from "./types";

const MAX_ITEMS = 100;

export interface TranscriptBufferEntry {
  original: string;
  translated: string;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyStatus(): SessionStatus {
  return {
    connectionState: "idle",
    username: null,
    viewerCount: 0,
    totalLikes: 0,
    followCount: 0,
    totalTranscripts: 0,
    totalCommentCount: 0,
    totalGiftCount: 0,
    totalGiftCoins: 0,
  };
}

export function calculateGiftCoins(
  diamondCount: number,
  repeatCount: number,
  count: number,
): number {
  const quantity = repeatCount > 0 ? repeatCount : count > 0 ? count : 1;
  return Math.max(0, diamondCount) * quantity;
}

export class SessionStore {
  private username: string | null = null;
  private transcripts: Transcript[] = [];
  private comments: Comment[] = [];
  private gifts: Gift[] = [];
  private status: SessionStatus = emptyStatus();
  private currentPartialTranscript = "";
  private currentPartialTranslation = "";
  private transcriptBuffer: TranscriptBufferEntry[] = [];
  private commentBuffer: Comment[] = [];
  private giftBuffer: Gift[] = [];

  reset(): void {
    this.username = null;
    this.transcripts = [];
    this.comments = [];
    this.gifts = [];
    this.status = emptyStatus();
    this.currentPartialTranscript = "";
    this.currentPartialTranslation = "";
    this.transcriptBuffer = [];
    this.commentBuffer = [];
    this.giftBuffer = [];
  }

  startSession(username: string): void {
    this.reset();
    this.username = username;
    this.status = {
      ...emptyStatus(),
      connectionState: "idle",
      username,
    };
  }

  setConnectionState(connectionState: ConnectionState): void {
    this.status = { ...this.status, connectionState };
  }

  setViewerCount(viewerCount: number): void {
    this.status = { ...this.status, viewerCount: Math.max(0, viewerCount) };
  }

  setTotalLikes(totalLikes: number): void {
    this.status = { ...this.status, totalLikes: Math.max(0, totalLikes) };
  }

  addLikes(count: number): void {
    if (count <= 0) {
      return;
    }
    this.status = {
      ...this.status,
      totalLikes: this.status.totalLikes + count,
    };
  }

  incrementFollowCount(): void {
    this.status = {
      ...this.status,
      followCount: this.status.followCount + 1,
    };
  }

  incrementTotalCommentCount(): void {
    this.status = {
      ...this.status,
      totalCommentCount: this.status.totalCommentCount + 1,
    };
  }

  setCurrentPartialTranscript(text: string): void {
    this.currentPartialTranscript = text;
  }

  setCurrentPartialTranslation(text: string): void {
    this.currentPartialTranslation = text;
  }

  getCurrentPartialTranscript(): string {
    return this.currentPartialTranscript;
  }

  getCurrentPartialTranslation(): string {
    return this.currentPartialTranslation;
  }

  appendTranscriptBuffer(original: string, translated: string): void {
    const trimmedOriginal = original.trim();
    const trimmedTranslated = translated.trim();
    if (!trimmedOriginal && !trimmedTranslated) {
      return;
    }
    this.transcriptBuffer.push({
      original: trimmedOriginal,
      translated: trimmedTranslated,
    });
  }

  drainTranscriptBuffer(): TranscriptBufferEntry[] {
    const drained = [...this.transcriptBuffer];
    this.transcriptBuffer = [];
    return drained;
  }

  appendCommentBuffer(comment: Comment): void {
    this.commentBuffer.push(comment);
  }

  drainCommentBuffer(): Comment[] {
    const drained = [...this.commentBuffer];
    this.commentBuffer = [];
    return drained;
  }

  getCommentBufferLength(): number {
    return this.commentBuffer.length;
  }

  appendGiftBuffer(gift: Gift): void {
    this.giftBuffer.push(gift);
  }

  drainGiftBuffer(): Gift[] {
    const drained = [...this.giftBuffer];
    this.giftBuffer = [];
    return drained;
  }

  getGiftBufferLength(): number {
    return this.giftBuffer.length;
  }

  clearDisplayTranscripts(): void {
    this.transcripts = [];
    this.status = {
      ...this.status,
      totalTranscripts: 0,
    };
  }

  addTranscript(
    entry: Omit<Transcript, "id" | "timestamp"> & { timestamp?: string },
  ): Transcript {
    const transcript: Transcript = {
      id: createId(),
      original: entry.original,
      translated: entry.translated,
      detectedLanguage: entry.detectedLanguage ?? "auto",
      timestamp: entry.timestamp ?? new Date().toISOString(),
    };

    this.transcripts.push(transcript);

    if (this.transcripts.length > MAX_ITEMS) {
      this.transcripts = this.transcripts.slice(-MAX_ITEMS);
    }

    this.status = {
      ...this.status,
      totalTranscripts: this.transcripts.length,
    };

    return transcript;
  }

  getCurrentTranscript(): Transcript | null {
    if (this.transcripts.length === 0) {
      return null;
    }
    return this.transcripts[this.transcripts.length - 1] ?? null;
  }

  addComment(entry: Omit<Comment, "id">): Comment {
    const comment: Comment = { id: createId(), ...entry };
    this.comments = [comment, ...this.comments].slice(0, MAX_ITEMS);
    return comment;
  }

  addGift(entry: Omit<Gift, "id">): Gift {
    const gift: Gift = { id: createId(), ...entry };
    const quantity =
      gift.repeatCount > 0 ? gift.repeatCount : gift.count > 0 ? gift.count : 1;
    const coins = calculateGiftCoins(
      gift.diamondCount,
      gift.repeatCount,
      gift.count,
    );

    this.gifts = [gift, ...this.gifts].slice(0, MAX_ITEMS);
    this.status = {
      ...this.status,
      totalGiftCount: this.status.totalGiftCount + quantity,
      totalGiftCoins: this.status.totalGiftCoins + coins,
    };
    return gift;
  }

  getSnapshot(): SessionData {
    return {
      username: this.username,
      transcripts: [...this.transcripts],
      comments: [...this.comments],
      gifts: [...this.gifts],
      status: { ...this.status },
      currentTranscript: this.getCurrentTranscript(),
      currentPartialTranscript: this.currentPartialTranscript,
      currentPartialTranslation: this.currentPartialTranslation,
    };
  }
}

const globalForStore = globalThis as typeof globalThis & {
  __tiktokSessionStore?: SessionStore;
};

export function getSessionStore(): SessionStore {
  if (!globalForStore.__tiktokSessionStore) {
    globalForStore.__tiktokSessionStore = new SessionStore();
  }
  return globalForStore.__tiktokSessionStore;
}
