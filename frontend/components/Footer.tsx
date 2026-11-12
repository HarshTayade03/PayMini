"use client";

export default function Footer() {
  const openNotice = () => {
    window.dispatchEvent(new Event("open-test-notice"));
  };

  return (
    <footer className="border-t border-neutral-200 bg-white py-6 mt-auto">
      <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-3">
        <p>© {new Date().getFullYear()} PayMini Demo Wallet. Built for learning purposes.</p>
        <div className="flex items-center gap-4">
          <button
            onClick={openNotice}
            className="text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
          >
            About test money
          </button>
          <span>•</span>
          <span className="text-neutral-400">Fake currency only</span>
        </div>
      </div>
    </footer>
  );
}
