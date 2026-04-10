#!/usr/bin/env node

import { ConvexHttpClient } from "convex/browser";
import { execSync } from "child_process";
import os from "os";

const CONVEX_URL = "https://calm-warbler-536.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

const NODE_NAME = process.env.NODE_NAME || "unknown";
const NODE_IP = process.env.NODE_IP || "unknown";

// Get hostname from system
let hostname = "unknown";
try {
  hostname = execSync("hostname -s", { encoding: "utf-8" }).trim();
} catch (e) {
  hostname = os.hostname();
}

function getCPUUsage() {
  try {
    const output = execSync("top -l 1 -n 0 | grep 'CPU usage'", { encoding: "utf-8" });
    const match = output.match(/user: ([\d.]+)%/);
    return match ? parseFloat(match[1]) : 0;
  } catch {
    return 0;
  }
}

function getMemoryUsage() {
  try {
    const output = execSync("vm_stat | grep -E 'Pages (free|wired)'", { encoding: "utf-8" });
    const lines = output.split("\n");
    let wired = 0;
    let free = 0;
    
    for (const line of lines) {
      if (line.includes("Pages wired")) {
        wired = parseInt(line.match(/\d+/)[0]) * 4096;
      }
      if (line.includes("Pages free")) {
        free = parseInt(line.match(/\d+/)[0]) * 4096;
      }
    }
    
    const totalMem = os.totalmem();
    const usedMem = totalMem - free;
    const percentage = (usedMem / totalMem) * 100;
    return Math.min(100, Math.max(0, percentage));
  } catch {
    return os.freemem() / os.totalmem() * 100;
  }
}

function getDiskUsage() {
  try {
    const output = execSync("df -h / | tail -1", { encoding: "utf-8" });
    const parts = output.split(/\s+/);
    const percentage = parseInt(parts[4]);
    return percentage || 0;
  } catch {
    return 0;
  }
}

function getTemperature() {
  try {
    // Try getting core temperature
    const output = execSync("sysctl -n machdep.cpu.core_temp_units 2>/dev/null || echo '0'", { encoding: "utf-8" }).trim();
    if (output !== "0") {
      return parseInt(output);
    }
    
    // Fallback: estimate from fan speed (rough approximation)
    const fanOutput = execSync("sysctl -n fan.0.min_rpm 2>/dev/null || echo '0'", { encoding: "utf-8" }).trim();
    return 60 + (parseInt(fanOutput) / 1000);
  } catch {
    return 60; // Default assumption
  }
}

function getBatteryLevel() {
  try {
    const output = execSync("pmset -g batt 2>/dev/null || echo '0%'", { encoding: "utf-8" });
    const match = output.match(/(\d+)%/);
    return match ? parseInt(match[1]) : null;
  } catch {
    return null;
  }
}

function getNeuralEngineUsage() {
  try {
    // Neural Engine usage is harder to measure directly
    // Approximate as percentage of CPU usage on Apple Silicon
    const cpuUsage = getCPUUsage();
    // Scale to neural engine activity (simplified)
    return Math.min(100, cpuUsage * 1.2);
  } catch {
    return 0;
  }
}

function getUptime() {
  try {
    const output = execSync("uptime", { encoding: "utf-8" });
    // Parse "up X days, HH:MM" or "up HH:MM"
    const match = output.match(/up\s+(?:(\d+)\s+days?,\s+)?(\d+):(\d+)/);
    if (match) {
      const days = match[1] ? parseInt(match[1]) : 0;
      const hours = parseInt(match[2]);
      const minutes = parseInt(match[3]);
      
      let uptimeStr = "";
      if (days > 0) uptimeStr += `${days}d `;
      if (hours > 0 || days > 0) uptimeStr += `${hours}h `;
      uptimeStr += `${minutes}m`;
      
      return uptimeStr.trim();
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

function getMLXConnectionInfo() {
  try {
    // Check if TB5 interface is up
    const output = execSync("ifconfig | grep -E 'en[0-9].*192.168.1'", { encoding: "utf-8" });
    if (output.includes("192.168.1")) {
      return { type: "TB5 Ethernet", speed: "20 Gbps", status: "connected" };
    }
    return { type: "TB5 Ethernet", speed: "20 Gbps", status: "disconnected" };
  } catch {
    return { type: "TB5 Ethernet", speed: "20 Gbps", status: "unknown" };
  }
}

async function collectMetrics() {
  try {
    const metrics = {
      nodeName: hostname,
      nodeIp: NODE_IP,
      timestamp: new Date().toISOString(),
      cpu: getCPUUsage(),
      memory: getMemoryUsage(),
      disk: getDiskUsage(),
      temperature: getTemperature(),
      batteryLevel: getBatteryLevel(),
      neuralEngine: getNeuralEngineUsage(),
      uptime: getUptime(),
      mlx: getMLXConnectionInfo(),
    };

    console.log(`[${new Date().toISOString()}] Metrics:`, JSON.stringify(metrics, null, 2));

    // Push to Convex
    try {
      await client.mutation("systemHealth:update", metrics);
      console.log(`✅ Sent to Convex`);
    } catch (convexError) {
      console.error(`⚠️ Convex error:`, convexError.message);
    }

    return metrics;
  } catch (error) {
    console.error("Error collecting metrics:", error.message);
    return null;
  }
}

// Run every 30 seconds
console.log(`🚀 System Health Monitor started for ${hostname}`);
console.log(`📊 Sending metrics to Convex every 30 seconds...`);

await collectMetrics();
setInterval(collectMetrics, 30000);

// Keep running
process.on("SIGINT", () => {
  console.log("\n✅ System Health Monitor stopped");
  process.exit(0);
});
