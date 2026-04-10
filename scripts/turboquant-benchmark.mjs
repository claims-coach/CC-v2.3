#!/usr/bin/env node
/**
 * TurboQuant Benchmark
 * Measure R&D Council performance before/after TurboQuant compression
 * Baseline: standard llama3.3:70b
 * Optimized: TurboQuant 4-bit compressed llama3.3:70b
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://mc-ollama.local:11434";

const testPrompts = [
  {
    name: "Simple Question",
    prompt: "What is 2+2?",
  },
  {
    name: "Code Generation",
    prompt: "Write a JavaScript function to reverse an array",
  },
  {
    name: "Complex Reasoning",
    prompt: "Explain the concept of diminished value in auto insurance claims and how it differs from actual cash value disputes",
  },
  {
    name: "Long Context",
    prompt: "Given a 2021 Toyota RAV4 LE with 42,500 miles, insurer valued at $18,500. Compare with current market comps (Honda CR-V $19,200, Toyota RAV4 $19,800, Mazda CX-5 $18,900). Calculate ACV and identify valuation gaps.",
  },
];

async function benchmarkModel(model, iterations = 3) {
  console.log(`\n📊 Benchmarking: ${model}`);
  console.log("─".repeat(60));

  const results = [];

  for (const test of testPrompts) {
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      try {
        const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model,
            prompt: test.prompt,
            stream: false,
            temperature: 0.7,
          }),
        });

        const data = await res.json();
        const elapsed = Date.now() - start;
        times.push(elapsed);

        if (i === 0) {
          console.log(`\n${test.name}:`);
          console.log(`  Output length: ${data.response?.length || 0} chars`);
        }
      } catch (err) {
        console.error(`  ✗ Error on iteration ${i + 1}:`, err.message);
        times.push(Infinity);
      }
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    results.push({
      test: test.name,
      avgTime,
      minTime,
      maxTime,
    });

    console.log(`  Avg: ${avgTime.toFixed(0)}ms | Min: ${minTime}ms | Max: ${maxTime}ms`);
  }

  return results;
}

async function main() {
  console.log("\n🚀 TurboQuant Performance Benchmark");
  console.log("═".repeat(60));
  console.log(`Ollama Host: ${OLLAMA_HOST}`);
  console.log(`Target models: llama3.3:70b (baseline) + TurboQuant variant`);

  // Check which models are available
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`);
    const data = await res.json();
    console.log(`\nAvailable models: ${data.models?.map((m: any) => m.name).join(", ")}`);
  } catch (err) {
    console.error("✗ Cannot reach Ollama:", err.message);
    process.exit(1);
  }

  // Benchmark baseline (if available)
  let baseline: any[] = [];
  try {
    baseline = await benchmarkModel("llama3.3:70b", 2);
  } catch (err) {
    console.warn("⚠ Baseline llama3.3:70b not available, skipping");
  }

  // Benchmark TurboQuant version (once available in Q3 2026)
  let turboquant: any[] = [];
  try {
    turboquant = await benchmarkModel("turboquant-llama3.3:70b", 2);
  } catch (err) {
    console.warn("⚠ TurboQuant variant not yet available (Q3 2026 release)");
  }

  // Compare
  if (baseline.length > 0 && turboquant.length > 0) {
    console.log("\n📈 Performance Improvement:");
    console.log("─".repeat(60));

    for (let i = 0; i < baseline.length; i++) {
      const b = baseline[i];
      const t = turboquant[i];
      const improvement = ((b.avgTime - t.avgTime) / b.avgTime) * 100;
      const speedup = (b.avgTime / t.avgTime).toFixed(2);

      console.log(`${b.test.padEnd(20)} ${speedup}x faster | ${improvement.toFixed(1)}% improvement`);
    }

    // R&D Council extrapolation
    console.log("\n🧠 R&D Council (5-member debate) projection:");
    const baselineTotal = baseline.reduce((sum, r) => sum + r.avgTime, 0) * 5;
    const turboquantTotal = turboquant.reduce((sum, r) => sum + r.avgTime, 0) * 5;
    console.log(`  Baseline: ${(baselineTotal / 1000).toFixed(1)}s`);
    console.log(`  TurboQuant: ${(turboquantTotal / 1000).toFixed(1)}s`);
    console.log(`  Speedup: ${(baselineTotal / turboquantTotal).toFixed(1)}x`);
  }

  console.log("\n✅ Benchmark complete");
}

main().catch(console.error);
