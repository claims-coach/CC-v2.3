#!/usr/bin/env node
/**
 * Task Worker
 * Runs on mc-dev, mc-ollama, or any worker machine
 * Polls coordinator for jobs, executes them, returns results
 */

import http from 'http';

const COORDINATOR_HOST = process.env.COORDINATOR_HOST || 'mc-prod.local';
const COORDINATOR_PORT = process.env.COORDINATOR_PORT || 9999;
const WORKER_ID = process.env.WORKER_ID || `worker-${require('os').hostname()}`;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000'); // 5 seconds

console.log(`\n🔗 Task Worker: ${WORKER_ID}`);
console.log(`📍 Coordinator: ${COORDINATOR_HOST}:${COORDINATOR_PORT}`);
console.log(`⏱️  Poll interval: ${POLL_INTERVAL}ms\n`);

async function executeTask(task) {
  console.log(`\n▶️  Executing: ${task.id} (${task.type})`);

  try {
    let result = {
      taskId: task.id,
      workerId: WORKER_ID,
      type: task.type,
      status: 'success',
      completedAt: new Date().toISOString(),
    };

    // Task execution logic
    switch (task.type) {
      case 'echo':
        result.output = `Echo: ${task.payload.message}`;
        break;

      case 'parse-estimate':
        // Would call estimateParser.ts here
        result.output = 'Estimate parsing stub';
        result.payload = { year: 2021, make: 'Toyota', model: 'RAV4' };
        break;

      case 'research-comps':
        // Would call Watson comp research
        result.output = 'Comps research stub';
        result.payload = { compsFound: 5, avgPrice: 22775 };
        break;

      case 'generate-report':
        // Would call Report agent
        result.output = 'Report generation stub';
        result.payload = { pdfUrl: '/path/to/report.pdf' };
        break;

      default:
        result.status = 'error';
        result.error = `Unknown task type: ${task.type}`;
    }

    // Send result back to coordinator
    await sendResult(result);
    console.log(`✅ Task complete: ${task.id}`);
  } catch (err) {
    console.error(`❌ Task failed: ${task.id}`, err.message);
    await sendResult({
      taskId: task.id,
      workerId: WORKER_ID,
      status: 'error',
      error: err.message,
      completedAt: new Date().toISOString(),
    });
  }
}

async function sendResult(result) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(result);

    const options = {
      hostname: COORDINATOR_HOST,
      port: COORDINATOR_PORT,
      path: '/result',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve());
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function pollForJobs() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: COORDINATOR_HOST,
      port: COORDINATOR_PORT,
      path: `/tasks?workerId=${WORKER_ID}`,
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 204) {
          resolve(null); // No tasks available
        } else if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000);
    req.end();
  });
}

async function main() {
  while (true) {
    try {
      const task = await pollForJobs();
      if (task) {
        await executeTask(task);
      } else {
        // No tasks, wait before polling again
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
      }
    } catch (err) {
      console.error(`⚠️  Poll error: ${err.message}`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
  }
}

main();
