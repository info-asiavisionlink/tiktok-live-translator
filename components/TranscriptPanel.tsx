import type { Transcript } from "@/lib/types";

interface TranscriptPanelProps {
  transcript: Transcript | null;
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

export function TranscriptPanel({ transcript }: TranscriptPanelProps) {
  return (
    <section className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-100">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">
        Current Transcript
      </h2>
      {transcript ? (
        <div className="mt-4 flex flex-1 flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Original
            </p>
            <p className="mt-1 text-lg leading-relaxed text-slate-800">
              {transcript.original}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-500">
              Translated
            </p>
            <p className="mt-1 text-lg font-medium leading-relaxed text-slate-900">
              {transcript.translated}
            </p>
          </div>
          <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
            <div>
              <dt className="text-slate-400">Language</dt>
              <dd className="font-semibold text-slate-700">
                {transcript.detectedLanguage}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Timestamp</dt>
              <dd className="font-semibold text-slate-700">
                {formatTimestamp(transcript.timestamp)}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="mt-6 flex flex-1 items-center justify-center text-slate-400">
          Waiting for audio transcription…
        </p>
      )}
    </section>
  );
}
