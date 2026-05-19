"use client";

import { useEffect } from "react";
import type { LiveSessionView } from "@/lib/useLiveSession";

interface TranscriptPanelProps {
  session: LiveSessionView;
}

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
  const transcript = session?.currentTranscript ?? null;

  useEffect(() => {
    console.log("[UI] Rendering transcript:", transcript?.original);
  }, [transcript?.original, transcript?.timestamp, transcript?.id]);

  const hasTranslation =
    transcript != null && transcript.translated.trim().length > 0;

  const contentKey =
    transcript?.id ??
    transcript?.timestamp ??
    "no-transcript";

  return (
    <section className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-100">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">
        Current Transcript
      </h2>
      {transcript ? (
        <div key={contentKey} className="mt-4 flex flex-1 flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Original
            </p>
            <p className="mt-1 text-lg leading-relaxed text-slate-800">
              {transcript.original}
            </p>
            </div>
          {hasTranslation && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-500">
                Translated
              </p>
              <p className="mt-1 text-lg font-medium leading-relaxed text-slate-900">
                {transcript.translated}
              </p>
            </div>
          )}
          <div className="mt-auto border-t border-slate-100 pt-4 text-sm">
            <p className="text-slate-400">Timestamp</p>
            <p className="font-semibold text-slate-700">
              {formatTimestamp(transcript.timestamp)}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-6 flex flex-1 items-center justify-center text-slate-400">
          Waiting for streamer speech…
        </p>
      )}
    </section>
  );
}
