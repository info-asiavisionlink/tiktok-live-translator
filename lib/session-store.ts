import type {
  Comment,
  Gift,
  MemberEntry,
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
    totalMembers: 0,
    totalLikes: 0,
  };
}

export class SessionStore {
  private username: string | null = null;
  private transcripts: Transcript[] = [];
  private comments: Comment[] = [];
  private gifts: Gift[] = [];
  private members: MemberEntry[] = [];
  private status: SessionStatus = emptyStatus();

  reset(): void {
    this.username = null;
    this.transcripts = [];
    this.comments = [];
    this.gifts = [];
    this.members = [];
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

  addComment(entry: Omit<Comment, "id">): Comment {
    const comment: Comment = { id: createId(), ...entry };
    this.comments = [comment, ...this.comments].slice(0, MAX_ITEMS);
    this.status = {
      ...this.status,
      totalComments: this.comments.length,
    };
    return comment;
  }

  updateCommentTranslation(id: string, translated: string): void {
    this.comments = this.comments.map((comment) =>
      comment.id === id ? { ...comment, translated } : comment,
    );
  }

  addGift(entry: Omit<Gift, "id">): Gift {
    const gift: Gift = { id: createId(), ...entry };
    this.gifts = [gift, ...this.gifts].slice(0, MAX_ITEMS);
    this.status = {
      ...this.status,
      totalGifts: this.gifts.length,
    };
    return gift;
  }

  addMember(username: string): MemberEntry {
    const member: MemberEntry = {
      id: createId(),
      username,
      timestamp: new Date().toISOString(),
    };
    this.members = [member, ...this.members].slice(0, MAX_ITEMS);
    this.status = {
      ...this.status,
      totalMembers: this.members.length,
    };
    return member;
  }

  addLike(count: number): void {
    this.status = {
      ...this.status,
      totalLikes: this.status.totalLikes + count,
    };
  }

  getSnapshot(): SessionData {
    return {
      username: this.username,
      transcripts: [...this.transcripts],
      comments: [...this.comments],
      gifts: [...this.gifts],
      members: [...this.members],
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
