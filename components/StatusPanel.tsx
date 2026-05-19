import type { ConnectionState, SessionStatus } from "@/lib/types";

interface StatusPanelProps {
  status: SessionStatus;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function connectionLabel(state: ConnectionState): string {
  switch (state) {
    case "connected":
      return "Connected";
    case "disconnected":
      return "Disconnected";
    case "ended":
      return "Stream Ended";
    default:
      return "Disconnected";
  }
}

function connectionIndicatorClass(state: ConnectionState): string {
  switch (state) {
    case "connected":
      return "bg-emerald-500 shadow-[0_0_8px] shadow-emerald-400";
    case "ended":
      return "bg-amber-500 shadow-[0_0_8px] shadow-amber-400";
    default:
      return "bg-slate-300";
  }
}

export function StatusPanel({ status }: StatusPanelProps) {
  const label = connectionLabel(status.connectionState);

  return (
    <section className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-100">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">
        Session Status
      </h2>
      <div className="mt-6 flex flex-1 flex-col gap-6">
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${connectionIndicatorClass(status.connectionState)}`}
            aria-hidden
          />
          <p className="text-lg font-semibold text-slate-800">{label}</p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Current Viewers" value={formatCount(status.viewerCount)} />
          <Stat label="Total Likes" value={formatCount(status.totalLikes)} />
          <Stat label="Total Follows" value={formatCount(status.followCount)} />
          <Stat
            label="Total Transcripts"
            value={formatCount(status.totalTranscripts)}
          />
          <Stat label="Total Comments" value={formatCount(status.totalComments)} />
          <Stat label="Total Gifts" value={formatCount(status.totalGiftCount)} />
          <Stat
            label="Total Gift Coins"
            value={formatCount(status.totalGiftCoins)}
          />
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold text-slate-900">{value}</dd>
    </div>
  );
}
