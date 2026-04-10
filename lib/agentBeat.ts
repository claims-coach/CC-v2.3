/**
 * agentBeat — lightweight helper to mark agent as working/done in Convex.
 * Safe to call from any Next.js API route (server-side only).
 * Fire-and-forget: never throws, never blocks the main route.
 */

const CONVEX_URL = "https://calm-warbler-536.convex.cloud";

async function callMutation(path: string, args: Record<string, unknown>) {
  try {
    await fetch(`${CONVEX_URL}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args, format: "json" }),
      signal: AbortSignal.timeout(4000),
    });
  } catch { /* never block the caller */ }
}

export async function agentStart(name: string, task: string) {
  await callMutation("agents:setWorking", { name, task });
}

export async function agentDone(name: string, result?: string) {
  await callMutation("agents:completeTask", { name, result });
}
