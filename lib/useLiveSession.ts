"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startTranslation, WebhookError } from "@/lib/api";
import {
  createMockComment,
  createMockGift,
  createMockTranscript,
  hasLivePayload,
} from "@/lib/mock";
import type {
  ApiResponse,
  Comment,
  Gift,
  SessionStatus,
  Transcript,
  TranslationPhase,
} from "@/lib/types";

const MOCK_TICK_MS = 3500;
const MAX_LIST_ITEMS = 50;

function buildSession(
  connected: boolean,
  transcripts: number,
  comments: number,
  gifts: number,
  partial?: Partial<SessionStatus>,
): SessionStatus {
  return {
    connected,
    totalTranscripts: partial?.totalTranscripts ?? transcripts,
    totalComments: partial?.totalComments ?? comments,
    totalGifts: partial?.totalGifts ?? gifts,
  };
}

function applyApiResponse(
  response: ApiResponse,
  setCurrentTranscript: (t: Transcript | null) => void,
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>,
  setGifts: React.Dispatch<React.SetStateAction<Gift[]>>,
  setSession: React.Dispatch<React.SetStateAction<SessionStatus>>,
) {
  const latestTranscript =
    response.transcript ??
    (response.transcripts?.length
      ? response.transcripts[response.transcripts.length - 1]
      : null);

  if (latestTranscript) {
    setCurrentTranscript(latestTranscript);
  }

  if (response.comments?.length) {
    setComments((prev) =>
      [...response.comments!, ...prev].slice(0, MAX_LIST_ITEMS),
    );
  }

  if (response.gifts?.length) {
    setGifts((prev) => [...response.gifts!, ...prev].slice(0, MAX_LIST_ITEMS));
  }

  setSession((prev) => {
    const transcriptCount =
      response.session?.totalTranscripts ??
      (latestTranscript ? prev.totalTranscripts + 1 : prev.totalTranscripts);
    const commentCount =
      response.session?.totalComments ??
      (response.comments?.length
        ? prev.totalComments + response.comments.length
        : prev.totalComments);
    const giftCount =
      response.session?.totalGifts ??
      (response.gifts?.length
        ? prev.totalGifts + response.gifts.length
        : prev.totalGifts);

    return buildSession(
      response.session?.connected ?? true,
      transcriptCount,
      commentCount,
      giftCount,
      response.session,
    );
  });
}

export function useLiveSession() {
  const [phase, setPhase] = useState<TranslationPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<Transcript | null>(
    null,
  );
  const [comments, setComments] = useState<Comment[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [session, setSession] = useState<SessionStatus>(
    buildSession(false, 0, 0, 0),
  );

  const mockIndexRef = useRef(0);
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopMockStream = useCallback(() => {
    if (mockIntervalRef.current) {
      clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = null;
    }
  }, []);

  const startMockStream = useCallback(() => {
    stopMockStream();
    setSession(buildSession(true, 0, 0, 0));

    mockIntervalRef.current = setInterval(() => {
      const index = mockIndexRef.current;
      mockIndexRef.current += 1;
      const tick = index % 3;

      if (tick === 0) {
        const transcript = createMockTranscript(index);
        setCurrentTranscript(transcript);
        setSession((prev) =>
          buildSession(true, prev.totalTranscripts + 1, prev.totalComments, prev.totalGifts),
        );
      } else if (tick === 1) {
        const comment = createMockComment(index);
        setComments((prev) => [comment, ...prev].slice(0, MAX_LIST_ITEMS));
        setSession((prev) =>
          buildSession(true, prev.totalTranscripts, prev.totalComments + 1, prev.totalGifts),
        );
      } else {
        const gift = createMockGift(index);
        setGifts((prev) => [gift, ...prev].slice(0, MAX_LIST_ITEMS));
        setSession((prev) =>
          buildSession(true, prev.totalTranscripts, prev.totalComments, prev.totalGifts + 1),
        );
      }
    }, MOCK_TICK_MS);
  }, [stopMockStream]);

  const resetSession = useCallback(() => {
    stopMockStream();
    mockIndexRef.current = 0;
    setCurrentTranscript(null);
    setComments([]);
    setGifts([]);
    setSession(buildSession(false, 0, 0, 0));
    setError(null);
    setSuccessMessage(null);
    setPhase("idle");
  }, [stopMockStream]);

  const handleStart = useCallback(async (url: string) => {
    setPhase("loading");
    setError(null);
    setSuccessMessage(null);
    setCurrentTranscript(null);
    setComments([]);
    setGifts([]);
    setSession(buildSession(false, 0, 0, 0));
    stopMockStream();
    mockIndexRef.current = 0;

    try {
      const response = await startTranslation(url);
      setPhase("active");
      setSuccessMessage(
        response.message ?? "Translation session started successfully.",
      );

      const shouldUseMock =
        response.useMockData === true || !hasLivePayload(response);

      if (!shouldUseMock) {
        applyApiResponse(
          response,
          setCurrentTranscript,
          setComments,
          setGifts,
          setSession,
        );
        setSession((prev) => ({ ...prev, connected: true }));
      } else {
        startMockStream();
        setSuccessMessage(
          (prev) =>
            `${prev ?? "Session started."} Showing sample data until live updates arrive from n8n.`,
        );
      }
    } catch (err) {
      setPhase("error");
      if (err instanceof WebhookError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    }
  }, [startMockStream, stopMockStream]);

  useEffect(() => {
    return () => stopMockStream();
  }, [stopMockStream]);

  return {
    phase,
    error,
    successMessage,
    currentTranscript,
    comments,
    gifts,
    session,
    handleStart,
    resetSession,
  };
}
