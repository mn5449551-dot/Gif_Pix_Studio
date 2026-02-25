import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get("url");
  if (!imageUrl) {
    return new Response("missing url", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return new Response("invalid url", { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return new Response("unsupported protocol", { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      cache: "no-store",
      redirect: "follow",
    });

    if (!upstream.ok) {
      const contentType = upstream.headers.get("content-type") ?? "text/plain; charset=utf-8";
      const detail = await upstream.text().catch(() => "");
      const reason = detail.trim().slice(0, 500) || `upstream failed: ${upstream.status}`;
      return new Response(reason, {
        status: upstream.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
          "X-Proxy-Upstream-Status": String(upstream.status),
        },
      });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const arrayBuffer = await upstream.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "upstream fetch failed";
    return new Response(message, { status: 502 });
  }
}
