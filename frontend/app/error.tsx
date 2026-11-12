"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console without breaking UI
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-neutral-200 p-8 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-neutral-900">Something Went Wrong</h1>
          <p className="text-xs text-neutral-500">
            An unexpected error occurred while rendering the page.
          </p>
        </div>
        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={() => reset()}
            className="py-2 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium rounded-lg transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
