import { NextRequest, NextResponse } from "next/server";

// Same-origin proxy: the browser never sees APP_API_TOKEN. It only ever
// talks to /api/proxy/*, and this route handler attaches the bearer token
// server-side before forwarding to the real backend.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
const API_TOKEN = process.env.APP_API_TOKEN ?? "";

async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  const upstreamUrl = new URL(`${API_BASE}/${path.join("/")}`);
  upstreamUrl.search = req.nextUrl.search;

  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.text();
    if (body) {
      init.body = body;
    }
  }

  const upstream = await fetch(upstreamUrl, init);
  const text = await upstream.text();

  return new NextResponse(text || null, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return forward(req, path);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return forward(req, path);
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return forward(req, path);
}
