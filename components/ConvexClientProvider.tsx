"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";

// v2.3 Convex project: fabulous-roadrunner-674
const CONVEX_URL = "https://fabulous-roadrunner-674.convex.cloud";

const convex = new ConvexReactClient(CONVEX_URL);

export default function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
