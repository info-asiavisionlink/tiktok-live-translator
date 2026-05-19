import { calculateGiftCoins } from "@/lib/session-store";
import type { Gift } from "@/lib/types";

interface GiftPanelProps {
  gifts: Gift[];
  totalGiftCount: number;
  totalGiftCoins: number;
}

function giftCoins(gift: Gift): number {
  return calculateGiftCoins(gift.diamondCount, gift.repeatCount, gift.count);
}

export function GiftPanel({
  gifts,
  totalGiftCount,
  totalGiftCoins,
}: GiftPanelProps) {
  return (
    <section className="flex h-full max-h-[480px] flex-col rounded-2xl bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-100">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">Gifts</h2>

      <div className="mt-4 flex gap-4 rounded-xl bg-rose-50/80 px-4 py-3 text-sm ring-1 ring-rose-100">
        <p className="text-slate-600">
          <span className="font-semibold text-slate-900">Total Gifts:</span>{" "}
          {totalGiftCount.toLocaleString()}
        </p>
        <p className="text-slate-600">
          <span className="font-semibold text-slate-900">Total Coins:</span>{" "}
          {totalGiftCoins.toLocaleString()}
        </p>
      </div>

      <ul className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {gifts.length === 0 ? (
          <li className="py-8 text-center text-slate-400">No gifts yet</li>
        ) : (
          gifts.map((gift) => {
            const coins = giftCoins(gift);
            return (
              <li
                key={gift.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-rose-600">
                    @{gift.username}
                  </p>
                  <p className="text-base font-medium text-slate-900">
                    {gift.giftName} × {gift.count}{" "}
                    <span className="text-sm font-normal text-slate-500">
                      ({coins.toLocaleString()} coins)
                    </span>
                  </p>
                </div>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-700">
                  ×{gift.count}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
