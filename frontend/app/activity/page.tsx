"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatPaiseToDisplay, formatDate } from "@/lib/format";
import { TransactionItem } from "@/lib/types";
import Navbar from "@/components/Navbar";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Filter, Loader2 } from "lucide-react";

export default function ActivityPage() {
  const [filter, setFilter] = useState<"all" | "sent" | "received">("all");
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTransactions = async (direction: string, cursor?: string | null) => {
    try {
      let url = `/api/proxy/transactions?direction=${direction}&limit=10`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();

      if (cursor) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
      }
      setNextCursor(data.next_cursor);
      setHasMore(data.has_more);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTransactions(filter);
  }, [filter]);

  const handleLoadMore = () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchTransactions(filter, nextCursor);
  };

  return (
    <>
      <Navbar userEmail={null} />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-semibold text-neutral-900">Activity History</h1>
          </div>

          {/* Direction Filter Pills */}
          <div className="flex items-center bg-neutral-100 p-1 rounded-lg text-xs font-medium">
            {(["all", "sent", "received"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`px-3 py-1 rounded-md transition-colors capitalize ${
                  filter === mode
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction List */}
        <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-neutral-500 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span>Loading ledger activity...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500 space-y-1">
              <p>No activity found</p>
              <p className="text-xs text-neutral-400">
                Transactions matching your filter will appear here.
              </p>
            </div>
          ) : (
            <>
              {items.map((item) => {
                const isCredit = item.entry_type === "CREDIT";
                return (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isCredit ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {item.counterparty_email ? (
                            isCredit ? `From ${item.counterparty_email}` : `To ${item.counterparty_email}`
                          ) : (
                            item.description
                          )}
                        </p>
                        <p className="text-xs text-neutral-400 truncate">
                          {formatDate(item.created_at)}
                          {item.note && ` • "${item.note}"`}
                        </p>
                      </div>
                    </div>

                    <div className="text-right pl-4 flex-shrink-0">
                      <p
                        className={`text-sm font-semibold tabular-nums font-mono ${
                          isCredit ? "text-emerald-600" : "text-neutral-900"
                        }`}
                      >
                        {isCredit ? "+" : "-"}₹{formatPaiseToDisplay(item.amount_paise)}
                      </p>
                      <p className="text-[11px] text-neutral-400 tabular-nums">
                        bal ₹{formatPaiseToDisplay(item.balance_after_paise)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <div className="p-4 text-center border-t border-neutral-100">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <span>Load more activity</span>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
