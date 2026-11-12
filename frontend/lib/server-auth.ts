import { cookies } from "next/headers";
import { User } from "@/lib/types";

// In container networks, Next.js calls backend at http://backend:8000; locally at http://localhost:8000
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";

export const SESSION_COOKIE_NAME = "paymini_jwt";

export function getSessionToken(): string | undefined {
  const cookieStore = cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function getCurrentUser(): Promise<User | null> {
  const token = getSessionToken();
  if (!token) return null;

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
