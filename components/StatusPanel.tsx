import type { SessionStatus } from "@/lib/types";

interface StatusPanelProps {
  status: SessionStatus;
}

export function StatusPanel({ status }: StatusPanelProps) {
  return (
    <section className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-100">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">
        Session Status
      </h2>
      <div className="mt-6 flex flex-1 flex-col gap-6">
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${
              status.connected
                ? "bg-emerald-500 shadow-[0_0_8px] shadow-emerald-400"
                : "bg-slate-300"
            }`}
            aria-hidden
          />
          <p className="text-lg font-semibold text-slate-800">
            {status.connected ? "Connected" : "Disconnected"}
          </p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Stat label="Total transcripts" value={status.totalTranscripts} />
          <Stat label="Total comments" value={status.totalComments} />
          <Stat label="Total gifts" value={status.totalGifts} />
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-4 text-center ring-1 ring-slate-100">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="mt-2 text-3xl font-bold text-slate-900">{value}</dd>
    </div>
  );
}

