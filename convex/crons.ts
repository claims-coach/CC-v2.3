// ============================================================
// crons.ts — Scheduled job processing
// ============================================================

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process job queue every 10 seconds
crons.interval(
  "process-job-queue",
  { seconds: 10 },
  internal.functions.jobDispatcher.processJobQueue
);

export default crons;
