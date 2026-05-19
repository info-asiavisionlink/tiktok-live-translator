import type { Comment, Gift, Transcript } from "./types";

const MOCK_TRANSCRIPTS: Omit<Transcript, "id" | "timestamp">[] = [
  {
    original: "みなさん、こんにちは！今日も配信に来てくれてありがとう。",
    translated: "Hello everyone! Thank you for joining today's stream.",
    detectedLanguage: "ja",
  },
  {
    original: "次はリクエスト曲を歌いますね。",
    translated: "Next, I'll sing a requested song.",
    detectedLanguage: "ja",
  },
  {
    original: "コメント見てます！海外の方もいらっしゃいますか？",
    translated: "I'm reading the comments! Are there viewers from overseas?",
    detectedLanguage: "ja",
  },
  {
    original: "ギフトありがとうございます！",
    translated: "Thank you for the gifts!",
    detectedLanguage: "ja",
  },
];

const MOCK_COMMENTS: Omit<Comment, "id" | "timestamp">[] = [
  {
    username: "viewer_usa",
    original: "Love this stream!",
    translated: "この配信大好き！",
  },
  {
    username: "tokyo_fan",
    original: "声きれいですね",
    translated: "Your voice is beautiful",
  },
  {
    username: "global_watch",
    original: "Can you sing an English song?",
    translated: "英語の曲歌えますか？",
  },
  {
    username: "live_lover",
    original: "Hello from Brazil!",
    translated: "ブラジルからこんにちは！",
  },
];

const MOCK_GIFTS: Omit<Gift, "id" | "timestamp">[] = [
  { username: "supporter_01", giftName: "Rose", count: 5 },
  { username: "vip_fan", giftName: "TikTok Universe", count: 1 },
  { username: "gift_master", giftName: "Finger Heart", count: 10 },
  { username: "new_viewer", giftName: "GG", count: 3 },
];

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createMockTranscript(index: number): Transcript {
  const sample = MOCK_TRANSCRIPTS[index % MOCK_TRANSCRIPTS.length];
  return {
    id: createId(),
    ...sample,
    timestamp: new Date().toISOString(),
  };
}

export function createMockComment(index: number): Comment {
  const sample = MOCK_COMMENTS[index % MOCK_COMMENTS.length];
  return {
    id: createId(),
    ...sample,
    timestamp: new Date().toISOString(),
  };
}

export function createMockGift(index: number): Gift {
  const sample = MOCK_GIFTS[index % MOCK_GIFTS.length];
  return {
    id: createId(),
    ...sample,
    timestamp: new Date().toISOString(),
  };
}

export function hasLivePayload(response: {
  transcript?: Transcript | null;
  transcripts?: Transcript[];
  comments?: Comment[];
  gifts?: Gift[];
}): boolean {
  const hasTranscript =
    response.transcript != null ||
    (response.transcripts != null && response.transcripts.length > 0);
  const hasComments =
    response.comments != null && response.comments.length > 0;
  const hasGifts = response.gifts != null && response.gifts.length > 0;
  return hasTranscript || hasComments || hasGifts;
}
