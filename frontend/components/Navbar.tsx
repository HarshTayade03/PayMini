"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Wallet, Send, Clock, LogOut } from "lucide-react";

interface NavbarProps {
  userEmail?: string | null;
}

export default function Navbar({ userEmail }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/login");
    router.refresh();
  };

  const navLinks = [
    { href: "/", label: "Home", icon: Wallet },
    { href: "/send", label: "Send", icon: Send },
    { href: "/activity", label: "Activity", icon: Clock },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo & Test Mode Pill */}
        <div className="flex items-center gap-3">
          <Link href="/" className="font-bold text-lg text-neutral-900 tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm shadow-sm">
              ₹
            </span>
            <span>PayMini</span>
          </Link>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
            Test mode
          </span>
        </div>

        {/* Navigation links for logged-in users */}
        {userEmail && (
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-neutral-100 text-neutral-900"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* User Actions */}
        <div className="flex items-center gap-3">
          {userEmail ? (
            <div className="flex items-center gap-2 text-xs text-neutral-600">
              <span className="hidden md:inline font-mono text-neutral-500">{userEmail}</span>
              <button
                onClick={handleLogout}
                title="Log out"
                className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3 py-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
