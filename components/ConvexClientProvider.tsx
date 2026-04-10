"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const CONVEX_URL = 
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'https://fabulous-roadrunner-674.convex.cloud'
    : 'https://fabulous-roadrunner-674.convex.cloud');

const convex = new ConvexReactClient(CONVEX_URL);
export default function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
