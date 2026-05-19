"use client";

import { useEffect, useRef } from "react";
import type { LiveSessionView } from "@/lib/useLiveSession";

interface TranscriptPanelProps {
  session: LiveSessionView;
}

const MAX_DISPLAY = 50;

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function TranscriptPanel({ session }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLUListElement>(null);

  const transcripts = [...(session.transcripts || [])]
    .reverse()
    .slice(0, MAX_DISPLAY);

  const newestId = transcripts[0]?.id ?? transcripts[0]?.timestamp ?? null;

  useEffect(() => {
    if (transcripts.length === 0) {
      return;
    }
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, [newestId, transcripts.length]);

  useEffect(() => {
    if (transcripts[0]) {
      console.log("[UI] Rendering transcript:", transcripts[0].original);
    }
  }, [newestId, transcripts]);

  return (
    <section className="flex h-full max-h-[420px] flex-col rounded-2xl bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-100">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">
        配信者の発話履歴
      </h2>
      <ul
        ref={scrollRef}
        className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1"
      >
        {transcripts.length === 0 ? (
          <li className="py-8 text-center text-slate-400">
            発話を待機中…
          </li>
        ) : (
          transcripts.map((transcript) => {
            const hasTranslation = transcript.translated.trim().length > 0;

            return (
              <li
                key={transcript.id ?? transcript.timestamp}
                className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Original
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-800">
                  {transcript.original}
                </p>
                {hasTranslation && (
                  <>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-rose-500">
                      Translated
                    </p>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-slate-900">
                      {transcript.translated}
                    </p>
                  </>
                )}
                <p className="mt-3 text-xs text-slate-400">
                  {formatTimestamp(transcript.timestamp)}
                </p>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
