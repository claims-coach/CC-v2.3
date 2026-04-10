import { NextRequest } from "next/server";

const GATEWAY = "http://127.0.0.1:18789";
const TOKEN   = "cef62d78fbff0347ed92d2b5fdfcc8fa0a8b18091e46eade";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const upstream = await fetch(`${GATEWAY}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      model:  "openclaw:main",
      stream: true,
      messages,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: err }), { status: upstream.status });
  }

  // Pass the SSE stream straight through to the browser
  return new Response(upstream.body, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
