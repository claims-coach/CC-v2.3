#!/usr/bin/env node
import http from 'http';

const COORDINATOR_HOST = process.env.COORDINATOR_HOST || 'mc-prod.local';
const COORDINATOR_PORT = process.env.COORDINATOR_PORT || 9999;
const WORKER_ID = process.env.WORKER_ID || 'mc-dev';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'mc-ollama.local';
const OLLAMA_PORT = process.env.OLLAMA_PORT || 11434;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000');

console.log(`\n🔗 Task Worker: ${WORKER_ID}`);
console.log(`📍 Coordinator: ${COORDINATOR_HOST}:${COORDINATOR_PORT}`);
console.log(`🧠 LLM: ${OLLAMA_HOST}:${OLLAMA_PORT} (llama3.3:70b)`);
console.log(`⏱️  Poll interval: ${POLL_INTERVAL}ms\n`);

async function callOllama(prompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'llama3.3:70b',
      prompt: prompt,
      stream: false,
    });

    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 60000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.response);
        } catch (e) {
          reject(new Error(`Ollama error: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000);
    req.write(payload);
    req.end();
  });
}

async function executeTask(task) {
  console.log(`\n▶️  Task: ${task.id} (${task.type})`);

  try {
    let result = {
      taskId: task.id,
      workerId: WORKER_ID,
      type: task.type,
      status: 'success',
      completedAt: new Date().toISOString(),
    };

    switch (task.type) {
      case 'echo':
        result.output = `Echo: ${task.payload.message}`;
        break;

      case 'generate-email':
        {
          const prompt = `You are a professional email writer for Claims.Coach, a public adjusting and appraisal consulting firm.

Write a compelling outreach email to a future client who has just had a vehicle accident. The email should:
- Be warm but professional
- Explain what we do (ACV appraisal disputes, diminished value reports, loss of use claims)
- Offer a free consultation
- Include a clear call-to-action
- Be 150-200 words

Context: ${task.payload.context || 'Initial contact with accident victim'}

Write ONLY the email body, no subject line.`;

          result.output = await callOllama(prompt);
          result.success = true;
        }
        break;

      case 'parse-estimate':
        result.output = 'Estimate parsing stub';
        break;

      case 'research-comps':
        result.output = 'Comps research stub';
        break;

      default:
        result.status = 'error';
        result.error = `Unknown task type: ${task.type}`;
    }

    await sendResult(result);
    console.log(`✅ Complete: ${task.id}`);
  } catch (err) {
    console.error(`❌ Failed: ${task.id} — ${err.message}`);
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
          resolve(null);
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
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
      }
    } catch (err) {
      console.error(`⚠️  Poll error: ${err.message}`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
  }
}

main();
