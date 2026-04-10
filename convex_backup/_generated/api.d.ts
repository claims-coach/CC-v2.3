/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as agents from "../agents.js";
import type * as aiUsage from "../aiUsage.js";
import type * as analyzeAllCases from "../analyzeAllCases.js";
import type * as autoValuation from "../autoValuation.js";
import type * as awardRequests from "../awardRequests.js";
import type * as calendar from "../calendar.js";
import type * as caseAttachments from "../caseAttachments.js";
import type * as caseManagement from "../caseManagement.js";
import type * as caseRegistry from "../caseRegistry.js";
import type * as cases from "../cases.js";
import type * as claims from "../claims.js";
import type * as clientMemory from "../clientMemory.js";
import type * as consensus from "../consensus.js";
import type * as content from "../content.js";
import type * as documents from "../documents.js";
import type * as driveFolderCreator from "../driveFolderCreator.js";
import type * as files from "../files.js";
import type * as ghl from "../ghl.js";
import type * as ghlBookingWebhook from "../ghlBookingWebhook.js";
import type * as ghlCalendar from "../ghlCalendar.js";
import type * as http from "../http.js";
import type * as marketingAds from "../marketingAds.js";
import type * as memories from "../memories.js";
import type * as negotiationTasks from "../negotiationTasks.js";
import type * as parseGeminiNotes from "../parseGeminiNotes.js";
import type * as projects from "../projects.js";
import type * as recordings from "../recordings.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as systemHealth from "../systemHealth.js";
import type * as tasks from "../tasks.js";
import type * as timeAndExpense from "../timeAndExpense.js";
import type * as valuations from "../valuations.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  agents: typeof agents;
  aiUsage: typeof aiUsage;
  analyzeAllCases: typeof analyzeAllCases;
  autoValuation: typeof autoValuation;
  awardRequests: typeof awardRequests;
  calendar: typeof calendar;
  caseAttachments: typeof caseAttachments;
  caseManagement: typeof caseManagement;
  caseRegistry: typeof caseRegistry;
  cases: typeof cases;
  claims: typeof claims;
  clientMemory: typeof clientMemory;
  consensus: typeof consensus;
  content: typeof content;
  documents: typeof documents;
  driveFolderCreator: typeof driveFolderCreator;
  files: typeof files;
  ghl: typeof ghl;
  ghlBookingWebhook: typeof ghlBookingWebhook;
  ghlCalendar: typeof ghlCalendar;
  http: typeof http;
  marketingAds: typeof marketingAds;
  memories: typeof memories;
  negotiationTasks: typeof negotiationTasks;
  parseGeminiNotes: typeof parseGeminiNotes;
  projects: typeof projects;
  recordings: typeof recordings;
  seed: typeof seed;
  settings: typeof settings;
  systemHealth: typeof systemHealth;
  tasks: typeof tasks;
  timeAndExpense: typeof timeAndExpense;
  valuations: typeof valuations;
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
