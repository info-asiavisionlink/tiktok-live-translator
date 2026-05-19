"use client";

import { useState } from "react";
import { CommentPanel } from "@/components/CommentPanel";
import { GiftPanel } from "@/components/GiftPanel";
import { StatusPanel } from "@/components/StatusPanel";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { URLForm } from "@/components/URLForm";
import { useLiveSession } from "@/lib/useLiveSession";
import { isValidTikTokLiveUrl, normalizeTikTokUrl } from "@/lib/validate";

export default function Home() {
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  const {
    phase,
    error,
    successMessage,
    currentTranscript,
    comments,
    gifts,
    session,
    handleStart,
    handleStop,
    resetSession,
  } = useLiveSession();

  const isLoading = phase === "loading";
  const showDashboard = phase === "active" || phase === "stopped";
  const showStop = phase === "active";
  const displayError = validationError ?? error;

  const onSubmit = () => {
    setValidationError(null);

    if (!isValidTikTokLiveUrl(url)) {
      setValidationError(
        "有効な TikTok Live URL を入力してください（例: https://www.tiktok.com/@username/live）。",
      );
      return;
    }

    void handleStart(normalizeTikTokUrl(url));
  };

  const onStop = () => {
    setStopping(true);
    void handleStop().finally(() => setStopping(false));
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-rose-50 via-white to-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            TikTok Live Translator
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            TikTok Live のコメント・ギフト・配信者の発話・視聴者数などをリアルタイムで表示します。
          </p>
        </header>

        <div className="mt-10">
          <URLForm
            url={url}
            loading={isLoading}
            stopping={stopping}
            showStop={showStop}
            disabled={phase === "active"}
            onUrlChange={setUrl}
            onSubmit={onSubmit}
            onStop={onStop}
          />

          {isLoading && (
            <div
              role="status"
              className="mx-auto mt-6 flex max-w-2xl items-center justify-center gap-3 rounded-2xl border border-rose-100 bg-white px-5 py-4 text-slate-700 shadow-sm"
            >
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500" />
              TikTok Live に接続しています…
            </div>
          )}

          {displayError && (
            <div
              role="alert"
              className="mx-auto mt-6 max-w-2xl rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800"
            >
              <p className="font-semibold">エラーが発生しました</p>
              <p className="mt-1 text-sm">{displayError}</p>
              {phase === "error" && (
                <button
                  type="button"
                  onClick={() => {
                    setValidationError(null);
                    resetSession();
                  }}
                  className="mt-3 text-sm font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
                >
                  もう一度試す
                </button>
              )}
            </div>
          )}

          {successMessage && phase === "active" && (
            <div
              role="status"
              className="mx-auto mt-6 max-w-2xl rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900"
            >
              <p className="font-semibold">セッション接続中</p>
              <p className="mt-1 text-sm">{successMessage}</p>
            </div>
          )}
        </div>

        {showDashboard && (
          <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
            <TranscriptPanel transcript={currentTranscript} />
            <StatusPanel status={session} />
            <CommentPanel comments={comments} />
            <GiftPanel
              gifts={gifts}
              totalGiftCount={session.totalGiftCount}
              totalGiftCoins={session.totalGiftCoins}
            />
          </div>
        )}
      </div>
    </div>
  );
}
