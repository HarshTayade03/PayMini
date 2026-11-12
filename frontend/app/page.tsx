import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getSessionToken } from "@/lib/server-auth";
import { Wallet as WalletType, TransactionHistoryResponse } from "@/lib/types";
import { formatPaiseToDisplay, formatDate } from "@/lib/format";
import Navbar from "@/components/Navbar";
import { ArrowUpRight, ArrowDownLeft, Plus, Send, Clock, ChevronRight } from "lucide-react";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";

async function getWalletData(token: string): Promise<WalletType | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/wallet`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getRecentTransactions(token: string): Promise<TransactionHistoryResponse | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/transactions?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const token = getSessionToken()!;
  const [wallet, transactions] = await Promise.all([
    getWalletData(token),
    getRecentTransactions(token),
  ]);

  const balancePaise = wallet ? wallet.balance_paise : 0;
  const recentItems = transactions ? transactions.items : [];

  return (
    <>
      <Navbar userEmail={user.email} />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Balance Card */}
        <section
          aria-labelledby="balance-heading"
          className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm space-y-6"
        >
          <div className="space-y-1">
            <h2 id="balance-heading" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Total Available Balance
            </h2>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl text-neutral-400 font-light">₹</span>
              <span className="text-4xl font-semibold tracking-tight text-neutral-900 tabular-nums font-mono">
                {formatPaiseToDisplay(balancePaise)}
              </span>
              <span className="text-xs font-medium text-neutral-400">INR</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Link
              href="/top-up"
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4 text-neutral-600" />
              <span>Add test money</span>
            </Link>

            <Link
              href="/send"
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>Send money</span>
            </Link>
          </div>
        </section>

        {/* Recent Activity Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-neutral-500" />
              <span>Recent Activity</span>
            </h3>
            {recentItems.length > 0 && (
              <Link
                href="/activity"
                className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-0.5"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100 shadow-sm overflow-hidden">
            {recentItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-neutral-500 space-y-1">
                <p>No transactions yet</p>
                <p className="text-xs text-neutral-400">
                  Send test money to any registered email to start your ledger.
                </p>
              </div>
            ) : (
              recentItems.map((item) => {
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
              })
            )}
          </div>
        </section>
      </main>
    </>
  );
}
