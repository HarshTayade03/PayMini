"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseDisplayToPaise, formatPaiseToDisplay } from "@/lib/format";
import Navbar from "@/components/Navbar";
import { ArrowLeft, CheckCircle2, AlertCircle, Plus } from "lucide-react";

export default function TopUpPage() {
  const router = useRouter();
  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newBalanceDisplay, setNewBalanceDisplay] = useState<string | null>(null);

  const presets = ["100.00", "250.00", "500.00", "1000.00"];

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    let paise = 0;
    try {
      paise = parseDisplayToPaise(amountStr);
    } catch {
      setErrorMsg("Please enter a valid amount (e.g. 200.00)");
      setLoading(false);
      return;
    }

    if (paise <= 0) {
      setErrorMsg("Amount must be greater than zero");
      setLoading(false);
      return;
    }

    if (paise > 100000) {
      setErrorMsg("Maximum top-up per request is ₹1,000.00");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/proxy/wallet/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_paise: paise }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || "Failed to add test money");
        setLoading(false);
        return;
      }

      setNewBalanceDisplay(data.balance_display);
      setSuccess(true);
      setLoading(false);
    } catch {
      setErrorMsg("Network error connecting to wallet service");
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar userEmail={null} />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold text-neutral-900">Add Test Money</h1>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {success ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm space-y-6 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-neutral-900">Test Money Added</h2>
              <p className="text-3xl font-bold font-mono tabular-nums text-neutral-900">
                ₹{newBalanceDisplay}
              </p>
              <p className="text-xs text-neutral-500">New available balance</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setAmountStr("");
                  setSuccess(false);
                }}
                className="py-2.5 px-4 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium transition-colors"
              >
                Add more
              </button>
              <Link
                href="/"
                className="py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center"
              >
                Back to Home
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleTopUp}
            className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm space-y-5"
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700" htmlFor="topup-amount">
                Amount to add (INR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm font-medium text-neutral-400">₹</span>
                <input
                  id="topup-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1000"
                  required
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 text-sm font-mono tabular-nums border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Quick Select Presets */}
              <div className="flex gap-2 pt-2">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountStr(preset)}
                    className="flex-1 py-1.5 px-2 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-md text-xs font-mono text-neutral-700 transition-colors"
                  >
                    +₹{preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-neutral-50 rounded-lg p-3 text-xs text-neutral-500 space-y-1">
              <p>• Max per request: ₹1,000.00</p>
              <p>• Daily cumulative limit: ₹5,000.00</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? "Adding..." : "Add to Wallet"}</span>
            </button>
          </form>
        )}
      </main>
    </>
  );
}
