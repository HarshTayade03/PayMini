"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseDisplayToPaise, formatPaiseToDisplay } from "@/lib/format";
import Navbar from "@/components/Navbar";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Send,
  Mail,
  FileText,
} from "lucide-react";

export default function SendMoneyPage() {
  const router = useRouter();

  // Step 1: Input, Step 2: Review, Step 3: Success Receipt
  const [step, setStep] = useState<"input" | "review" | "success">("input");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any>(null);

  // Validate before proceeding to Review step
  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let paise = 0;
    try {
      paise = parseDisplayToPaise(amountStr);
    } catch {
      setErrorMsg("Please enter a valid amount (e.g. 50.00)");
      return;
    }

    if (paise <= 0) {
      setErrorMsg("Transfer amount must be greater than zero");
      return;
    }

    if (paise > 200000) {
      setErrorMsg("Maximum single transfer limit is ₹2,000.00");
      return;
    }

    setStep("review");
  };

  // Step 2: Confirm transfer with unique Idempotency Key per attempt
  const handleConfirmTransfer = async () => {
    setLoading(true);
    setErrorMsg(null);

    const idempotencyKey = crypto.randomUUID();
    const paise = parseDisplayToPaise(amountStr);

    try {
      const res = await fetch("/api/proxy/transfers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          amount_paise: paise,
          note: note.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || "Transfer failed. Please verify recipient and balance.");
        setLoading(false);
        setStep("input");
        return;
      }

      setReceipt(data);
      setStep("success");
      setLoading(false);
    } catch {
      setErrorMsg("Network error occurred during transfer. Please check activity before retrying.");
      setLoading(false);
      setStep("input");
    }
  };

  return (
    <>
      <Navbar userEmail={null} />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (step === "review") setStep("input");
              else router.push("/");
            }}
            className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-neutral-900">
            {step === "input" && "Send Test Money"}
            {step === "review" && "Review Transfer"}
            {step === "success" && "Transfer Completed"}
          </h1>
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

        {/* STEP 1: INPUT FORM */}
        {step === "input" && (
          <form
            onSubmit={handleProceedToReview}
            className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm space-y-4"
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700" htmlFor="recipient">
                Recipient Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  id="recipient"
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700" htmlFor="amount">
                Amount (INR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm font-medium text-neutral-400">₹</span>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="2000"
                  required
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 text-sm font-mono tabular-nums border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-[11px] text-neutral-400">
                Single transfer limit: ₹2,000.00 fake currency
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700" htmlFor="note">
                Note (Optional)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  id="note"
                  type="text"
                  maxLength={140}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Lunch, project share"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <span>Continue to Review</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: REVIEW CONFIRMATION */}
        {step === "review" && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm space-y-6">
            <div className="text-center space-y-1 py-2">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Sending</p>
              <p className="text-3xl font-bold font-mono tabular-nums text-neutral-900">
                ₹{formatPaiseToDisplay(parseDisplayToPaise(amountStr))}
              </p>
            </div>

            <div className="bg-neutral-50 rounded-lg p-4 divide-y divide-neutral-200/60 text-xs space-y-2">
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">To</span>
                <span className="font-medium text-neutral-900 font-mono">{recipientEmail}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Payment method</span>
                <span className="font-medium text-neutral-900">PayMini Demo Wallet</span>
              </div>
              {note && (
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">Note</span>
                  <span className="font-medium text-neutral-900 truncate max-w-[200px]">{note}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-500 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
              <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Protected by idempotency keys to prevent duplicate charges.</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setStep("input")}
                className="py-2.5 px-4 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmTransfer}
                className="py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? "Sending..." : "Confirm & Send"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS RECEIPT */}
        {step === "success" && receipt && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm space-y-6 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-neutral-900">Transfer Successful</h2>
              <p className="text-3xl font-bold font-mono tabular-nums text-emerald-600">
                ₹{formatPaiseToDisplay(receipt.amount_paise)}
              </p>
              <p className="text-xs text-neutral-500">Sent to {receipt.recipient_email}</p>
            </div>

            <div className="bg-neutral-50 rounded-lg p-4 text-xs space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-neutral-500">Reference ID</span>
                <span className="font-mono text-neutral-700 truncate max-w-[220px]">{receipt.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Status</span>
                <span className="font-medium text-emerald-700">{receipt.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Time</span>
                <span className="text-neutral-700">{new Date(receipt.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setRecipientEmail("");
                  setAmountStr("");
                  setNote("");
                  setStep("input");
                }}
                className="py-2.5 px-4 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium transition-colors"
              >
                Send another
              </button>
              <Link
                href="/"
                className="py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center"
              >
                Back to Home
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
