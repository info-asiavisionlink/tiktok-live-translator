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
  translated: string;
  timestamp?: string;
}

export interface Gift {
  id: string;
  username: string;
  giftName: string;
  count: number;
  timestamp?: string;
}

export interface SessionStatus {
  connected: boolean;
  totalTranscripts: number;
  totalComments: number;
  totalGifts: number;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  transcript?: Transcript | null;
  transcripts?: Transcript[];
  comments?: Comment[];
  gifts?: Gift[];
  session?: Partial<SessionStatus>;
  useMockData?: boolean;
}

export type TranslationPhase = "idle" | "loading" | "error" | "active";
