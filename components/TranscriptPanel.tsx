"use client";

import { useEffect, useRef } from "react";
import type { LiveSessionView } from "@/lib/useLiveSession";

interface TranscriptPanelProps {
  session: LiveSessionView;
}

const MAX_DISPLAY = 50;

export function TranscriptPanel({ session }: TranscriptPanelProps) {
  const historyRef = useRef<HTMLUListElement>(null);

  const partial = session.currentPartialTranscript?.trim() ?? "";

  const history = [...(session.transcripts || [])]
    .reverse()
    .slice(0, MAX_DISPLAY);

  const newestId = history[0]?.id ?? history[0]?.timestamp ?? null;

  useEffect(() => {
    if (partial) {
      console.log("[UI] Rendering partial:", partial);
    }
  }, [partial]);

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
    <section className="flex h-full max-h-[480px] flex-col rounded-2xl bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-100">
      <h2 className="shrink-0 text-xl font-bold tracking-tight text-slate-900">
        配信者の発話
      </h2>

      <div className="mt-4 shrink-0 rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-rose-500">
          現在認識中
        </p>
        <p className="mt-2 min-h-[2.5rem] text-2xl font-medium leading-relaxed text-slate-900">
          {partial || (
            <span className="text-lg font-normal text-slate-400">…</span>
          )}
        </p>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <p className="shrink-0 text-sm font-semibold text-slate-700">発話履歴</p>
        <ul
          ref={historyRef}
          className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-sm leading-relaxed text-slate-800"
        >
          {history.length === 0 ? (
            <li className="py-6 text-center text-slate-400">
              確定した発話はまだありません
            </li>
          ) : (
            history.map((transcript) => (
              <li key={transcript.id ?? transcript.timestamp}>
                • {transcript.original}
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
