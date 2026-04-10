// ============================================================
// http.ts — Convex HTTP router
// ============================================================

import { httpRouter } from "convex/server";
import { ghlIntake, telegram } from "./functions/webhooks.js";

const http = httpRouter();

http.route({
  path: "/ghl/intake",
  method: "POST",
  handler: ghlIntake,
});

http.route({
  path: "/telegram",
  method: "POST",
  handler: telegram,
});

export default http;
