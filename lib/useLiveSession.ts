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
  totalComments: 0,
  totalGiftCount: 0,
  totalGiftCoins: 0,
};

export function useLiveSession() {
  const [phase, setPhase] = useState<TranslationPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<Transcript | null>(
    null,
  );
  const [comments, setComments] = useState<Comment[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [session, setSession] = useState<SessionStatus>(EMPTY_STATUS);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  const syncFromServer = useCallback(async () => {
    try {
      const data = await fetchSession();
      const latestTranscript =
        data.transcripts[0] ?? data.transcript ?? null;

      setCurrentTranscript(latestTranscript);
      setComments(data.comments);
      setGifts(data.gifts);
      setSession(data.status);
    } catch (err) {
      if (isPollingRef.current) {
        console.error("[session] Poll failed:", err);
      }
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    isPollingRef.current = true;
    void syncFromServer();
    pollIntervalRef.current = setInterval(() => {
      void syncFromServer();
    }, POLL_INTERVAL_MS);
  }, [stopPolling, syncFromServer]);

  const resetSession = useCallback(() => {
    stopPolling();
    void stopLiveSession();
    setCurrentTranscript(null);
    setComments([]);
    setGifts([]);
    setSession(EMPTY_STATUS);
    setError(null);
    setSuccessMessage(null);
    setPhase("idle");
  }, [stopPolling]);

  const handleStop = useCallback(async () => {
    stopPolling();
    await stopLiveSession();
    await syncFromServer();
    setPhase("stopped");
    setSuccessMessage(null);
  }, [stopPolling, syncFromServer]);

  const handleStart = useCallback(
    async (url: string) => {
      setPhase("loading");
      setError(null);
      setSuccessMessage(null);
      setCurrentTranscript(null);
      setComments([]);
      setGifts([]);
      setSession(EMPTY_STATUS);
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
    currentTranscript,
    comments,
    gifts,
    session,
    handleStart,
    handleStop,
    resetSession,
  };
}
