"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchSession, startLiveSession, stopLiveSession } from "@/lib/api";
import type {
  Comment,
  Gift,
  SessionStatus,
  Transcript,
  TranslationPhase,
} from "@/lib/types";

const POLL_INTERVAL_MS = 2000;

const EMPTY_STATUS: SessionStatus = {
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

export interface LiveSessionView {
  status: SessionStatus;
  currentTranscript: Transcript | null;
  currentPartialTranscript: string;
  currentPartialTranslation: string;
  transcripts: Transcript[];
}

function resolveCurrentTranscript(data: {
  currentTranscript?: Transcript | null;
  transcript?: Transcript | null;
  transcripts: Transcript[];
}): Transcript | null {
  const fromApi = data.currentTranscript ?? data.transcript;
  if (fromApi) {
    return { ...fromApi };
  }
  if (data.transcripts.length > 0) {
    const latest = data.transcripts[data.transcripts.length - 1];
    return latest ? { ...latest } : null;
  }
  return null;
}

export function useLiveSession() {
  const [phase, setPhase] = useState<TranslationPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [session, setSession] = useState<LiveSessionView>({
    status: EMPTY_STATUS,
    currentTranscript: null,
    currentPartialTranscript: "",
    currentPartialTranslation: "",
    transcripts: [],
  });
  const [comments, setComments] = useState<Comment[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldPollRef = useRef(false);

  const stopPolling = useCallback(() => {
    shouldPollRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!shouldPollRef.current) {
      return;
    }

    try {
      const data = await fetchSession();

      if (data.status.connectionState === "ended") {
        stopPolling();
      }

      const currentTranscript = resolveCurrentTranscript(data);

      setSession({
        status: { ...data.status },
        currentTranscript,
        currentPartialTranscript: data.currentPartialTranscript ?? "",
        currentPartialTranslation: data.currentPartialTranslation ?? "",
        transcripts: [...data.transcripts],
      });
      setComments([...data.comments]);
      setGifts([...data.gifts]);
    } catch (err) {
      if (shouldPollRef.current) {
        console.error("[session] Poll failed:", err);
      }
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    shouldPollRef.current = true;
    void poll();
    intervalRef.current = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
  }, [poll, stopPolling]);

  const resetSession = useCallback(() => {
    stopPolling();
    void stopLiveSession();
    setSession({
      status: EMPTY_STATUS,
      currentTranscript: null,
      currentPartialTranscript: "",
      currentPartialTranslation: "",
      transcripts: [],
    });
    setComments([]);
    setGifts([]);
    setError(null);
    setSuccessMessage(null);
    setPhase("idle");
  }, [stopPolling]);

  const handleStop = useCallback(async () => {
    stopPolling();
    await stopLiveSession();
    await poll();
    setPhase("stopped");
    setSuccessMessage(null);
  }, [poll, stopPolling]);

  const handleStart = useCallback(
    async (url: string) => {
      setPhase("loading");
      setError(null);
      setSuccessMessage(null);
      setSession({
        status: EMPTY_STATUS,
        currentTranscript: null,
        currentPartialTranscript: "",
        currentPartialTranslation: "",
        transcripts: [],
      });
      setComments([]);
      setGifts([]);
      stopPolling();

      try {
        const result = await startLiveSession(url);
        setPhase("active");
        setSuccessMessage(
          `@${result.username} のライブに接続しました。リアルタイムでイベントを表示しています。`,
        );
        startPolling();
      } catch (err) {
        setPhase("error");
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("予期しないエラーが発生しました。もう一度お試しください。");
        }
      }
    },
    [startPolling, stopPolling],
  );

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    phase,
    error,
    successMessage,
    session,
    comments,
    gifts,
    handleStart,
    handleStop,
    resetSession,
  };
}
