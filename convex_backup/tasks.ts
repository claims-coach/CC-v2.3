import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const enqueueTask = mutation({
  args: {
    type: v.string(),
    payload: v.any(),
  },
  async handler(ctx, args) {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await ctx.db.insert('tasks', {
      id: taskId,
      type: args.type,
      payload: args.payload,
      status: 'queued',
      createdAt: new Date().toISOString(),
    });
    return { taskId, status: 'queued' };
  },
});

export const getNextTask = mutation({
  args: { workerId: v.string() },
  async handler(ctx, args) {
    const tasks = await ctx.db
      .query('tasks')
      .filter((q) => q.eq(q.field('status'), 'queued'))
      .order('asc')
      .take(1);

    if (tasks.length === 0) return null;

    const task = tasks[0];
    await ctx.db.patch(task._id, {
      status: 'running',
      workerId: args.workerId,
      startedAt: new Date().toISOString(),
    });

    return {
      id: task.id,
      type: task.type,
      payload: task.payload,
    };
  },
});

export const submitResult = mutation({
  args: {
    taskId: v.string(),
    status: v.string(),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const task = await ctx.db
      .query('tasks')
      .filter((q) => q.eq(q.field('id'), args.taskId))
      .take(1);

    if (task.length === 0) return { error: 'Task not found' };

    await ctx.db.patch(task[0]._id, {
      status: args.status as 'success' | 'error' | 'queued' | 'running',
      result: args.output ?? undefined,
      error: args.error ?? undefined,
      completedAt: new Date().toISOString(),
    });

    return { status: 'saved' };
  },
});

export const getTaskResult = query({
  args: { taskId: v.string() },
  async handler(ctx, args) {
    const tasks = await ctx.db
      .query('tasks')
      .filter((q) => q.eq(q.field('id'), args.taskId))
      .take(1);

    if (tasks.length === 0) return null;
    return tasks[0];
  },
});

// ── Kanban board functions used by tasks page ─────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query('tasks').order('desc').collect(),
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    assignee: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    dueDate: v.optional(v.string()),
    claimId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('tasks', {
      ...args,
      status: (args.status ?? 'todo') as any,
      createdAt: new Date().toISOString(),
    });
  },
});

export const updateStatus = mutation({
  args: { id: v.id('tasks'), status: v.string() },
  handler: async (ctx, { id, status }) =>
    ctx.db.patch(id, { status: status as any, updatedAt: Date.now() }),
});

export const update = mutation({
  args: {
    id: v.id('tasks'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
    priority: v.optional(v.string()),
    assignee: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const clean: any = {};
    for (const [k, val] of Object.entries(patch)) if (val !== undefined) clean[k] = val;
    return ctx.db.patch(id, { ...clean, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});

export const getQueueStats = query({
  args: {},
  async handler(ctx) {
    const allTasks = await ctx.db.query('tasks').collect();
    const queuedTasks = allTasks.filter((t) => t.status === 'queued').length;
    const completedTasks = allTasks.filter((t) => t.status === 'success').length;

    return {
      status: 'running' as const,
      queuedTasks,
      completedTasks,
      totalTasks: allTasks.length,
      timestamp: new Date().toISOString(),
    };
  },
});
