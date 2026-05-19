"use client";

interface URLFormProps {
  url: string;
  loading: boolean;
  disabled?: boolean;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
}

export function URLForm({
  url,
  loading,
  disabled = false,
  onUrlChange,
  onSubmit,
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
        disabled={loading || disabled}
        onChange={(event) => onUrlChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-900 shadow-sm outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={loading || disabled}
        className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-rose-200 transition hover:from-rose-600 hover:to-pink-700 focus:outline-none focus:ring-4 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[220px]"
      >
        {loading ? "Starting…" : "Start Translation"}
      </button>
    </form>
  );
}
