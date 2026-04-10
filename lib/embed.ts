/**
 * Local embedding via Ollama nomic-embed-text (768 dimensions)
 * Falls back gracefully if Ollama is unreachable (Vercel/cold start)
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

export async function embed(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.embedding ?? null;
  } catch {
    return null;
  }
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  return Promise.all(texts.map(t => embed(t)));
}
