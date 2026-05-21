export type ConnectionState = "idle" | "connected" | "disconnected" | "ended";

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
  connectionState: ConnectionState;
  username: string | null;
  viewerCount: number;
  totalLikes: number;
  followCount: number;
  totalTranscripts: number;
  totalComments: number;
  totalGiftCount: number;
  totalGiftCoins: number;
}

export interface SessionData {
  username: string | null;
  transcripts: Transcript[];
  comments: Comment[];
  gifts: Gift[];
  status: SessionStatus;
  currentTranscript: Transcript | null;
  currentPartialTranscript: string;
  currentPartialTranslation: string;
}

export interface StartApiResponse {
  success: boolean;
  username?: string;
  message?: string;
}

export type TranslationPhase = "idle" | "loading" | "error" | "active" | "stopped";
