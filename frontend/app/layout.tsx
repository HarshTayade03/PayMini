import type { Metadata } from "next";
import "./globals.css";
import TestNoticeModal from "@/components/TestNoticeModal";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "PayMini - Peer-to-Peer Digital Wallet Simulation",
  description: "A clean, secure peer-to-peer digital wallet simulation built for software engineers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900 font-sans">
        <TestNoticeModal />
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
