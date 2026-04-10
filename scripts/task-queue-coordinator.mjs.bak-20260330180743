#!/usr/bin/env node
/**
 * Task Queue Coordinator (HTTP Frontend)
 * Runs on mc-prod, talks to Convex backend for persistence
 * Stateless - can restart without losing tasks
 */

import http from 'http';
import url from 'url';
import https from 'https';

const PORT = 9999;
const CONVEX_URL = process.env.CONVEX_URL || 'https://calm-warbler-536.convex.cloud';
const CONVEX_KEY = process.env.CONVEX_KEY || '';

// Worker presence tracking — updated on every poll, expires after 30s of silence
const WORKERS = new Map(); // workerId -> { lastSeen: number, tasksCompleted: number }
const WORKER_TIMEOUT_MS = 30_000;

async function callConvex(mutation, args) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ path: mutation, args });
    const convexUrl = new URL(`${CONVEX_URL}/api/json`);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Bearer ${CONVEX_KEY}`,
      },
    };

    const req = https.request(convexUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Convex error: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // POST /task → enqueue via Convex
    if (req.method === 'POST' && pathname === '/task') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const task = JSON.parse(body);
          const result = await callConvex('tasks:enqueueTask', {
            type: task.type,
            payload: task.payload,
          });
          console.log(`✅ Task enqueued: ${result.taskId}`);
          res.writeHead(202);
          res.end(JSON.stringify(result));
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
      // Record heartbeat — worker is alive as long as it keeps polling
      const existing = WORKERS.get(workerId) || { tasksCompleted: 0 };
      WORKERS.set(workerId, { lastSeen: Date.now(), tasksCompleted: existing.tasksCompleted });
      try {
        const task = await callConvex('tasks:getNextTask', { workerId });
        if (!task) {
          res.writeHead(204);
          res.end();
        } else {
          console.log(`📤 Task dispatched to ${workerId}: ${task.id}`);
          WORKERS.set(workerId, { lastSeen: Date.now(), tasksCompleted: existing.tasksCompleted + 1 });
          res.writeHead(200);
          res.end(JSON.stringify(task));
        }
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // GET /workers → current worker presence
    if (req.method === 'GET' && pathname === '/workers') {
      const now = Date.now();
      const workers = Array.from(WORKERS.entries()).map(([workerId, info]) => ({
        workerId,
        lastSeen: new Date(info.lastSeen).toISOString(),
        tasksCompleted: info.tasksCompleted,
        status: (now - info.lastSeen) < WORKER_TIMEOUT_MS ? 'online' : 'offline',
      }));
      res.writeHead(200);
      res.end(JSON.stringify({ workers, timestamp: new Date().toISOString() }));
      return;
    }

    // POST /result → worker returns result
    if (req.method === 'POST' && pathname === '/result') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const result = JSON.parse(body);
          await callConvex('tasks:submitResult', {
            taskId: result.taskId,
            status: result.status,
            output: result.output,
            error: result.error,
          });
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
      try {
        const result = await callConvex('tasks:getTaskResult', { taskId });
        if (!result) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'not found' }));
        } else {
          res.writeHead(200);
          res.end(JSON.stringify(result));
        }
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // GET /status → health check
    if (req.method === 'GET' && pathname === '/status') {
      try {
        const stats = await callConvex('tasks:getQueueStats', {});
        res.writeHead(200);
        res.end(JSON.stringify(stats));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not found' }));
  } catch (err) {
    console.error('Error:', err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Task Queue Coordinator (Convex-backed) listening on port ${PORT}`);
  console.log(`📊 Backend: ${CONVEX_URL}`);
  console.log(`POST /task        → enqueue a job`);
  console.log(`GET /tasks        → fetch next job (for workers)`);
  console.log(`POST /result      → submit job result`);
  console.log(`GET /result/:id   → get job result`);
  console.log(`GET /status       → health check\n`);
});
