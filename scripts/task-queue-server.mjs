#!/usr/bin/env node
/**
 * Task Queue Server
 * Runs on mc-prod (coordinator)
 * Receives jobs, dispatches to workers, collects results
 */

import http from 'http';
import url from 'url';

const PORT = 9999;
const TASK_QUEUE = [];
const RESULTS = new Map();

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // POST /task → enqueue a job
  if (req.method === 'POST' && pathname === '/task') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const task = JSON.parse(body);
        const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        task.id = taskId;
        task.status = 'queued';
        task.createdAt = new Date().toISOString();
        TASK_QUEUE.push(task);
        console.log(`✅ Task enqueued: ${taskId} (${task.type})`);
        res.writeHead(202);
        res.end(JSON.stringify({ taskId, status: 'queued' }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /tasks → get next job for a worker
  if (req.method === 'GET' && pathname === '/tasks') {
    const workerId = parsedUrl.query.workerId || 'unknown';
    if (TASK_QUEUE.length === 0) {
      res.writeHead(204); // No content
      res.end();
      return;
    }
    const task = TASK_QUEUE.shift();
    task.status = 'running';
    task.workerId = workerId;
    task.startedAt = new Date().toISOString();
    console.log(`📤 Task dispatched to ${workerId}: ${task.id}`);
    res.writeHead(200);
    res.end(JSON.stringify(task));
    return;
  }

  // POST /result → worker returns result
  if (req.method === 'POST' && pathname === '/result') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const result = JSON.parse(body);
        RESULTS.set(result.taskId, result);
        console.log(`✅ Result received: ${result.taskId}`);
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'saved' }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /result/:taskId → get result
  if (req.method === 'GET' && pathname.startsWith('/result/')) {
    const taskId = pathname.slice(8);
    const result = RESULTS.get(taskId);
    if (!result) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify(result));
    return;
  }

  // GET /status → health check
  if (req.method === 'GET' && pathname === '/status') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'running',
      queuedTasks: TASK_QUEUE.length,
      completedTasks: RESULTS.size,
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Task Queue Server running on port ${PORT}`);
  console.log(`POST /task        → enqueue a job`);
  console.log(`GET /tasks        → fetch next job (for workers)`);
  console.log(`POST /result      → submit job result`);
  console.log(`GET /result/:id   → get job result`);
  console.log(`GET /status       → health check\n`);
});
