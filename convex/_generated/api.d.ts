/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as functions_activityLog from "../functions/activityLog.js";
import type * as functions_cccParser from "../functions/cccParser.js";
import type * as functions_commands from "../functions/commands.js";
import type * as functions_comparables from "../functions/comparables.js";
import type * as functions_documents from "../functions/documents.js";
import type * as functions_emails from "../functions/emails.js";
import type * as functions_ingestedEvents from "../functions/ingestedEvents.js";
import type * as functions_jobDispatcher from "../functions/jobDispatcher.js";
import type * as functions_jobs from "../functions/jobs.js";
import type * as functions_matters from "../functions/matters.js";
import type * as functions_prospects from "../functions/prospects.js";
import type * as functions_seed from "../functions/seed.js";
import type * as functions_sequences from "../functions/sequences.js";
import type * as functions_tasks from "../functions/tasks.js";
import type * as functions_webhooks from "../functions/webhooks.js";
import type * as functions_workers from "../functions/workers.js";
import type * as http from "../http.js";
import type * as lib_transitions from "../lib/transitions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "functions/activityLog": typeof functions_activityLog;
  "functions/cccParser": typeof functions_cccParser;
  "functions/commands": typeof functions_commands;
  "functions/comparables": typeof functions_comparables;
  "functions/documents": typeof functions_documents;
  "functions/emails": typeof functions_emails;
  "functions/ingestedEvents": typeof functions_ingestedEvents;
  "functions/jobDispatcher": typeof functions_jobDispatcher;
  "functions/jobs": typeof functions_jobs;
  "functions/matters": typeof functions_matters;
  "functions/prospects": typeof functions_prospects;
  "functions/seed": typeof functions_seed;
  "functions/sequences": typeof functions_sequences;
  "functions/tasks": typeof functions_tasks;
  "functions/webhooks": typeof functions_webhooks;
  "functions/workers": typeof functions_workers;
  http: typeof http;
  "lib/transitions": typeof lib_transitions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
