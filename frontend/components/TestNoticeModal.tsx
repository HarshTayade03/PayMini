"use client";

import { useEffect, useState, useRef } from "react";
import { AlertCircle, ShieldAlert } from "lucide-react";

export const TEST_NOTICE_KEY = "paymini_test_notice_acknowledged";

export default function TestNoticeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Check if acknowledged previously in localStorage
    const acknowledged = localStorage.getItem(TEST_NOTICE_KEY);
    if (!acknowledged) {
      setIsOpen(true);
    }

    // Allow re-opening via global custom event dispatched from footer / menu
    const handleReopen = () => setIsOpen(true);
    window.addEventListener("open-test-notice", handleReopen);
    return () => window.removeEventListener("open-test-notice", handleReopen);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [isOpen]);

  const handleAcknowledge = () => {
    localStorage.setItem(TEST_NOTICE_KEY, "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-desc"
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-neutral-200 p-6 space-y-4">
        <div className="flex items-center gap-3 text-amber-600">
          <ShieldAlert className="w-6 h-6 flex-shrink-0" />
          <h2 id="modal-title" className="text-lg font-semibold text-neutral-900">
            Educational Demo Notice
          </h2>
        </div>

        <div id="modal-desc" className="text-sm text-neutral-600 space-y-2 leading-relaxed">
          <p>
            Welcome to <strong>PayMini</strong>. This application is a strictly educational, learning
            simulation built for software engineering interviews.
          </p>
          <p className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs">
            <strong>Important:</strong> All balances, deposits, and transfers use <strong>fake test money</strong>.
            Do not enter real credit cards, bank accounts, or sensitive payment credentials anywhere in this app.
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            ref={buttonRef}
            onClick={handleAcknowledge}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}
