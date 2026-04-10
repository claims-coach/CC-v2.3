"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
// v2.3: fabulous-roadrunner-674
const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL || "https://fabulous-roadrunner-674.convex.cloud"
);
export default function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
