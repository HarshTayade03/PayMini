import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-neutral-200 p-8 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 bg-neutral-100 text-neutral-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-neutral-900">Page Not Found</h1>
          <p className="text-xs text-neutral-500">
            The screen or resource you are looking for does not exist in PayMini.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
