import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/server-auth";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const { access_token, user } = data;

    // Set secure, httpOnly, SameSite=Lax cookie
    const response = NextResponse.json({ success: true, user });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: { error: "internal_error", message: "Failed to connect to backend service" } },
      { status: 500 }
    );
  }
}
