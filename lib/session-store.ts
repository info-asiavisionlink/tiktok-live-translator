import type {
  Comment,
  Gift,
  SessionData,
  SessionStatus,
  Transcript,
} from "./types";

const MAX_ITEMS = 100;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyStatus(): SessionStatus {
  return {
    connected: false,
    username: null,
    totalTranscripts: 0,
    totalComments: 0,
    totalGifts: 0,
    totalGiftCoins: 0,
  };
}

function giftCoinTotal(gifts: Gift[]): number {
  return gifts.reduce(
    (sum, gift) => sum + gift.count * Math.max(0, gift.diamondCount),
    0,
  );
}

export class SessionStore {
  private username: string | null = null;
  private transcripts: Transcript[] = [];
  private comments: Comment[] = [];
  private gifts: Gift[] = [];
  private status: SessionStatus = emptyStatus();

  reset(): void {
    this.username = null;
    this.transcripts = [];
    this.comments = [];
    this.gifts = [];
    this.status = emptyStatus();
  }

  startSession(username: string): void {
    this.reset();
    this.username = username;
    this.status = {
      ...emptyStatus(),
      connected: false,
      username,
    };
  }

  setConnected(connected: boolean): void {
    this.status = { ...this.status, connected };
  }

  addTranscript(entry: Omit<Transcript, "id">): Transcript {
    const transcript: Transcript = { id: createId(), ...entry };
    this.transcripts = [transcript, ...this.transcripts].slice(0, MAX_ITEMS);
    this.status = {
      ...this.status,
      totalTranscripts: this.transcripts.length,
    };
    return transcript;
  }

  updateTranscriptTranslation(id: string, translated: string): void {
    this.transcripts = this.transcripts.map((transcript) =>
      transcript.id === id ? { ...transcript, translated } : transcript,
    );
  }

  addComment(entry: Omit<Comment, "id">): Comment {
    const comment: Comment = { id: createId(), ...entry };
    this.comments = [comment, ...this.comments].slice(0, MAX_ITEMS);
    this.status = {
      ...this.status,
      totalComments: this.comments.length,
    };
    return comment;
  }

  addGift(entry: Omit<Gift, "id">): Gift {
    const gift: Gift = { id: createId(), ...entry };
    this.gifts = [gift, ...this.gifts].slice(0, MAX_ITEMS);
    this.status = {
      ...this.status,
      totalGifts: this.gifts.length,
      totalGiftCoins: giftCoinTotal(this.gifts),
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
