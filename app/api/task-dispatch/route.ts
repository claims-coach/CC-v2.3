/**
 * Intelligent Task Dispatch API
 * Auto-routes tasks to appropriate agents with tracking
 */

import { NextRequest, NextResponse } from "next/server";

interface TaskRequest {
  taskType:
    | "comp_search"
    | "estimate_analysis"
    | "report_generation"
    | "negotiation"
    | "research";
  claimId?: string;
  data: Record<string, any>;
  priority?: "low" | "normal" | "high" | "urgent";
}

interface TaskResponse {
  taskId: string;
  agent: string;
  status: "queued" | "running" | "complete";
  estimatedTime: number; // seconds
  trackingUrl: string;
  confidenceGate: number; // 0-100
}

/**
 * Route task to appropriate agent
 */
function routeTask(taskType: string): { agent: string; model: string; estimatedTime: number } {
  const routing: Record<string, { agent: string; model: string; estimatedTime: number }> = {
    comp_search: {
      agent: "Watson",
      model: "grok-4-latest + haiku",
      estimatedTime: 180, // 3 minutes
    },
    estimate_analysis: {
      agent: "Analysis",
      model: "sonnet-4.5",
      estimatedTime: 120, // 2 minutes
    },
    report_generation: {
      agent: "Report",
      model: "sonnet-4.5",
      estimatedTime: 600, // 10 minutes
    },
    negotiation: {
      agent: "Chris",
      model: "sonnet-4.6 + gpt-4",
      estimatedTime: 240, // 4 minutes
    },
    research: {
      agent: "Watson",
      model: "grok-4-latest",
      estimatedTime: 300, // 5 minutes
    },
  };

  return routing[taskType] || { agent: "Watson", model: "unknown", estimatedTime: 300 };
}

/**
 * Generate unique task ID
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TaskRequest;
    const { taskType, claimId, data, priority = "normal" } = body;

    if (!taskType) {
      return NextResponse.json({ error: "taskType required" }, { status: 400 });
    }

    // Route to appropriate agent
    const { agent, model, estimatedTime } = routeTask(taskType);

    // Generate tracking ID
    const taskId = generateTaskId();

    // Determine confidence gate based on task type
    let confidenceGate = 70; // default
    if (taskType === "comp_search") confidenceGate = 75; // High bar for comps (must be real)
    if (taskType === "report_generation") confidenceGate = 85; // Very high for reports
    if (taskType === "negotiation") confidenceGate = 80; // High for negotiation

    // Build response
    const response: TaskResponse = {
      taskId,
      agent,
      status: "queued",
      estimatedTime,
      trackingUrl: `/api/task-status/${taskId}`,
      confidenceGate,
    };

    // TODO: In production, queue this to Convex or message broker
    console.log(`[Dispatch] Task ${taskId} → Agent: ${agent} | Type: ${taskType} | Confidence Gate: ${confidenceGate}/100`);

    // Trigger agent (in production, this would be async)
    // For now, return immediately with tracking info
    if (taskType === "comp_search") {
      // Would call POST /api/find-comps with tracking
      console.log(`[Watson] Comp search queued: ${JSON.stringify(data)}`);
    }

    return NextResponse.json({
      success: true,
      task: response,
      message: `Task dispatched to ${agent}. Tracking ID: ${taskId}`,
    });
  } catch (e) {
    console.error("Task dispatch error:", e);
    return NextResponse.json({ error: "Task dispatch failed" }, { status: 500 });
  }
}

/**
 * GET task status
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    // TODO: In production, query Convex for task status
    return NextResponse.json({
      taskId,
      status: "complete", // mock
      result: {
        agent: "Watson",
        completedAt: new Date().toISOString(),
        output: "Mock result",
      },
    });
  } catch (e) {
    console.error("Task status error:", e);
    return NextResponse.json({ error: "Task status lookup failed" }, { status: 500 });
  }
}
