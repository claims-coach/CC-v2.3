import { NextResponse } from 'next/server';

const COORDINATOR_URL = process.env.COORDINATOR_URL || 'http://mc-prod.local:9999';

export async function GET() {
  try {
    const res = await fetch(`${COORDINATOR_URL}/workers`, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`coordinator ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Coordinator unreachable — return all workers as offline
    return NextResponse.json({
      workers: [],
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
}
