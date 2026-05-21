"use client";

import { useEffect, useRef } from "react";
import type { LiveSessionView } from "@/lib/useLiveSession";

interface TranscriptPanelProps {
  session: LiveSessionView;
}

const MAX_DISPLAY = 50;

export function TranscriptPanel({ session }: TranscriptPanelProps) {
  const historyRef = useRef<HTMLUListElement>(null);

  const partialOriginal = session.currentPartialTranscript?.trim() ?? "";
  const partialTranslation = session.currentPartialTranslation?.trim() ?? "";

  const history = [...(session.transcripts || [])]
    .reverse()
    .slice(0, MAX_DISPLAY);

  const newestId = history[0]?.id ?? history[0]?.timestamp ?? null;

  useEffect(() => {
    if (partialOriginal || partialTranslation) {
      console.log("[UI] Rendering partial:", {
        original: partialOriginal,
        translation: partialTranslation,
      });
    }
  }, [partialOriginal, partialTranslation]);

  useEffect(() => {
    if (history.length === 0) {
      return;
    }
    const el = historyRef.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, [newestId, history.length]);

  return (
    <section className="flex h-full max-h-[560px] flex-col rounded-2xl bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-100">
      <h2 className="shrink-0 text-xl font-bold tracking-tight text-slate-900">
        配信者の発話
      </h2>

      <div className="mt-4 shrink-0 space-y-3">
        <div className="rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-500">
            現在認識中
          </p>
          <p className="mt-2 min-h-[2rem] text-xl font-medium leading-relaxed text-slate-900">
            {partialOriginal || (
              <span className="text-lg font-normal text-slate-400">…</span>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">
            現在翻訳中（日本語）
          </p>
          <p className="mt-2 min-h-[2rem] text-xl font-medium leading-relaxed text-slate-900">
            {partialTranslation || (
              <span className="text-lg font-normal text-slate-400">…</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <p className="shrink-0 text-sm font-semibold text-slate-700">発話履歴</p>
        <ul
          ref={historyRef}
          className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm leading-relaxed text-slate-800"
        >
          {history.length === 0 ? (
            <li className="py-6 text-center text-slate-400">
              確定した発話はまだありません
            </li>
          ) : (
            history.map((transcript) => (
              <li key={transcript.id ?? transcript.timestamp}>
                <p>• {transcript.original}</p>
                {transcript.translated.trim().length > 0 && (
                  <p className="ml-3 text-slate-600">→ {transcript.translated}</p>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
