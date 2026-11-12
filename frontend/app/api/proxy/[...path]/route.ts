import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/server-auth";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxy(req, params.path);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxy(req, params.path);
}

async function handleProxy(req: NextRequest, pathSegments: string[]) {
  const token = getSessionToken();
  if (!token) {
    return NextResponse.json(
      { error: { error: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const subpath = pathSegments.join("/");
  const url = new URL(req.url);
  const targetUrl = `${BACKEND_URL}/api/v1/${subpath}${url.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const options: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      const bodyText = await req.text();
      if (bodyText) options.body = bodyText;
    } catch {
      // no body
    }
  }

  try {
    const res = await fetch(targetUrl, options);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: { error: "proxy_error", message: "Backend communication failed" } },
      { status: 502 }
    );
  }
}
