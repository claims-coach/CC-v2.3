// Ollama local inference client
// Routes to http://localhost:11434 — free, runs on M4 Metal

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const DEFAULT_MODEL = "qwen2.5:14b";
const FAST_MODEL    = "llama3.2:3b";

export async function ollamaChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { model?: string; temperature?: number; json?: boolean } = {}
): Promise<string> {
  const model = opts.model ?? DEFAULT_MODEL;
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { temperature: opts.temperature ?? 0.2 },
      ...(opts.json ? { format: "json" } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.message?.content ?? "";
}

export async function ollamaFast(prompt: string, systemPrompt?: string): Promise<string> {
  return ollamaChat(
    [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      { role: "user", content: prompt },
    ],
    { model: FAST_MODEL }
  );
}

export async function ollamaSmart(prompt: string, systemPrompt?: string, json = false): Promise<string> {
  return ollamaChat(
    [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      { role: "user", content: prompt },
    ],
    { model: DEFAULT_MODEL, json }
  );
}

export { DEFAULT_MODEL, FAST_MODEL };
