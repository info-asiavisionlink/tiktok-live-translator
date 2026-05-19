export interface Transcript {
  id: string;
  original: string;
  translated: string;
  detectedLanguage: string;
  timestamp: string;
}

export interface Comment {
  id: string;
  username: string;
  original: string;
  timestamp?: string;
}

export interface Gift {
  id: string;
  username: string;
  giftName: string;
  count: number;
  repeatCount: number;
  diamondCount: number;
  giftId: number | string | null;
  timestamp?: string;
}

export interface SessionStatus {
  connected: boolean;
  username: string | null;
  totalTranscripts: number;
  totalComments: number;
  totalGifts: number;
  totalGiftCoins: number;
}

export interface SessionData {
  username: string | null;
  transcripts: Transcript[];
  comments: Comment[];
  gifts: Gift[];
  status: SessionStatus;
}

export interface StartApiResponse {
  success: boolean;
  username?: string;
  message?: string;
}

export type TranslationPhase = "idle" | "loading" | "error" | "active";
