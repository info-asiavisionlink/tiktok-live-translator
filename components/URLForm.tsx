"use client";

interface URLFormProps {
  url: string;
  loading: boolean;
  stopping?: boolean;
  showStop?: boolean;
  disabled?: boolean;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

export function URLForm({
  url,
  loading,
  stopping = false,
  showStop = false,
  disabled = false,
  onUrlChange,
  onSubmit,
  onStop,
}: URLFormProps) {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-2xl space-y-4"
    >
      <label htmlFor="tiktok-url" className="sr-only">
        TikTok Live URL
      </label>
      <input
        id="tiktok-url"
        type="url"
        inputMode="url"
        autoComplete="url"
        placeholder="https://www.tiktok.com/@username/live"
        value={url}
        disabled={loading || stopping}
        onChange={(event) => onUrlChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-900 shadow-sm outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={loading || stopping || (disabled && !showStop)}
          className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-rose-200 transition hover:from-rose-600 hover:to-pink-700 focus:outline-none focus:ring-4 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[220px]"
        >
          {loading ? "接続中…" : "翻訳を開始"}
        </button>
        {showStop && (
          <button
            type="button"
            onClick={onStop}
            disabled={loading || stopping}
            className="w-full rounded-2xl border border-slate-300 bg-white px-6 py-4 text-lg font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[160px]"
          >
            {stopping ? "終了中…" : "終了する"}
          </button>
        )}
      </div>
    </form>
  );
}
