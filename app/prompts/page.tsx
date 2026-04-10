"use client";
import { useState, useRef } from "react";
import { Zap, Copy, Check, Loader, ChevronRight } from "lucide-react";

const PROMPTS = [
  {
    category: "Growth",
    label: "Next Content Move",
    icon: "🚀",
    prompt: `You are an expert claims coaching and insurance strategy advisor for Claims Coach, a public adjusting and appraisal consulting firm in Everett, WA with national reach. What is 1 content or SEO task we can do right now to get closer to the Claims Coach mission of helping policyholders maximize their insurance claims? Be specific and actionable.`,
  },
  {
    category: "SEO",
    label: "Keyword Gap Analysis",
    icon: "🔍",
    prompt: `You are an expert in insurance claims coaching and content strategy. What keyword opportunity is Claims Coach missing that competitors in the claims coaching or public adjuster space are winning? Give specific keyword examples and why they matter for our target audience: vehicle owners who've been lowballed by insurance companies.`,
  },
  {
    category: "Content",
    label: "Blog Post Idea",
    icon: "📝",
    prompt: `You are a content strategist for Claims Coach, a platform helping policyholders navigate insurance claims. What is the single best blog post we could publish this week? Give me: the title, target keyword, search intent, and a detailed outline with H2s and H3s. Focus on diminished value, ACV disputes, or loss of use claims.`,
  },
  {
    category: "Strategy",
    label: "Biggest Content Gap",
    icon: "⚡",
    prompt: `You are an insurance claims content strategist. What is the biggest gap in Claims Coach's current content and SEO strategy, and give a concrete 3-step plan to fix it this month? Consider that our services include ACV appraisal clause disputes, diminished value reports, loss of use claims, and expert witness services.`,
  },
  {
    category: "Competitive",
    label: "Top Brand Playbook",
    icon: "🏆",
    prompt: `You are a top insurance claims coaching expert. What would the #1 most trusted claims coaching brand in the US be doing for content, SEO, and community that Claims Coach isn't doing yet? Give 3 specific, actionable tactics tailored to a public adjusting and appraisal firm with national reach but a regional base in the Pacific Northwest.`,
  },
  {
    category: "Wild Card",
    label: "Surprise Me",
    icon: "🎲",
    prompt: `You are a creative growth advisor for Claims Coach, a public adjusting and appraisal firm helping policyholders fight back against lowball insurance settlements. Surprise me — give one unexpected, creative growth idea that most public adjusters or claims coaches would never think of. Think outside the industry playbook.`,
  },
  {
    category: "Marketing",
    label: "Social Hook Generator",
    icon: "🎯",
    prompt: `You are a viral social media strategist for Claims Coach. Write 5 short-form video hooks (TikTok/Reels/YouTube Shorts) that would stop a scroll and speak directly to someone who just got a lowball offer from their insurance company after a car accident. Each hook should be under 15 words and create immediate curiosity or urgency.`,
  },
  {
    category: "Client",
    label: "Objection Handlers",
    icon: "🤝",
    prompt: `You are a sales coach for Claims Coach. What are the 5 most common objections policyholders give when considering hiring a public adjuster or appraiser, and what is the ideal 1-2 sentence response to each? Focus on objections like cost, timeline, "my insurance is fair," and "I can handle it myself."`,
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Growth: "#22C55E",
  SEO: "#147EFA",
  Content: "#7C3AED",
  Strategy: "#FF8600",
  Competitive: "#F5C842",
  "Wild Card": "#EF4444",
  Marketing: "#EC4899",
  Client: "#14B8A6",
};

export default function PromptsPage() {
  const [response, setResponse]   = useState("");
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [custom, setCustom]       = useState("");
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);

  const fire = async (prompt: string, label?: string) => {
    if (loading) return;
    setLoading(true);
    setResponse("");
    setActiveLabel(label || "Custom");
    setActivePrompt(prompt);
    try {
      const res  = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, maxTokens: 1500 }),
      });
      const data = await res.json();
      setResponse(data.content || "No response.");
    } catch {
      setResponse("Error — could not reach AI.");
    }
    setLoading(false);
  };

  const fireCustom = () => {
    const p = custom.trim();
    if (!p) return;
    fire(`You are an expert claims coaching and insurance strategy advisor for Claims Coach, a public adjusting and appraisal firm. ${p}`, "Custom");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#F1F5F9" }}>

      {/* Header */}
      <div style={{ background: "#0F172A", padding: "14px 24px", flexShrink: 0, borderBottom: "1px solid #1E293B", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#147EFA" }} />
        <span style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.04em", textTransform: "uppercase" }}>Prompt Engine</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#1E2A3D", color: "#147EFA" }}>Claims.Coach Strategy AI</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: 0 }}>

        {/* Left — Prompt buttons */}
        <div style={{ width: 300, flexShrink: 0, overflowY: "auto", background: "#FFFFFF", borderRight: "1px solid #E2E8F0", padding: "20px 16px" }}>
          {/* Top Task Now — featured card */}
          <button
            onClick={() => fire(`You are an expert claims coaching and insurance strategy advisor for Claims Coach, a public adjusting and appraisal consulting firm in Everett, WA. Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}. What is the single most important content task Claims Coach should do TODAY to move the business forward? Be specific, actionable, and prioritize impact. One task only.`, "Top Task Now")}
            disabled={loading}
            style={{
              width: "100%", display: "flex", alignItems: "flex-start", gap: 12,
              background: "#0F172A", border: `1px solid ${activeLabel === "Top Task Now" ? "#147EFA" : "#1E293B"}`,
              borderRadius: 12, padding: "14px 16px", cursor: loading ? "not-allowed" : "pointer",
              marginBottom: 16, textAlign: "left", transition: "all 0.15s",
              boxShadow: activeLabel === "Top Task Now" ? "0 0 0 2px rgba(20,126,250,0.25)" : "none",
            }}
          >
            <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>🎯</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#147EFA", marginBottom: 4, letterSpacing: "0.01em" }}>
                {loading && activeLabel === "Top Task Now"
                  ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> Thinking…</span>
                  : "Top Task Now"
                }
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#CBD5E1", lineHeight: 1.4 }}>
                What&apos;s 1 content task to move<br />Claims Coach forward today?
              </div>
            </div>
          </button>

          <p style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>Quick Prompts</p>

          {PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => fire(p.prompt, p.label)}
              disabled={loading}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                background: activeLabel === p.label ? "#EFF6FF" : "#F8FAFC",
                border: `1px solid ${activeLabel === p.label ? "#BFDBFE" : "#E2E8F0"}`,
                borderLeft: `3px solid ${CATEGORY_COLORS[p.category] || "#147EFA"}`,
                borderRadius: 8, padding: "10px 12px", cursor: loading ? "not-allowed" : "pointer",
                marginBottom: 8, textAlign: "left", opacity: loading && activeLabel !== p.label ? 0.5 : 1,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>{p.label}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: CATEGORY_COLORS[p.category] || "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.category}</div>
              </div>
              {loading && activeLabel === p.label
                ? <Loader size={13} color="#147EFA" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                : <ChevronRight size={13} color="#CBD5E1" style={{ flexShrink: 0 }} />
              }
            </button>
          ))}

          {/* Custom prompt */}
          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 16, marginTop: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Custom Prompt</p>
            <textarea
              ref={textareaRef}
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) fireCustom(); }}
              placeholder="Ask anything about Claims.Coach strategy, content, SEO, client objections…"
              style={{
                width: "100%", minHeight: 90, resize: "vertical", border: "1px solid #E2E8F0",
                borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#334155",
                fontFamily: "inherit", outline: "none", background: "#F8FAFC", lineHeight: 1.5,
              }}
            />
            <button
              onClick={fireCustom}
              disabled={loading || !custom.trim()}
              style={{
                marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                background: loading || !custom.trim() ? "#F1F5F9" : "#147EFA",
                border: "none", borderRadius: 8, padding: "9px",
                color: loading || !custom.trim() ? "#94A3B8" : "#FFFFFF",
                fontSize: 12, fontWeight: 700, cursor: loading || !custom.trim() ? "not-allowed" : "pointer",
              }}
            >
              {loading && activeLabel === "Custom"
                ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
                : <><Zap size={13} /> Fire (⌘↵)</>
              }
            </button>
          </div>
        </div>

        {/* Right — Response */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column" }}>
          {!response && !loading && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "#94A3B8" }}>
              <Zap size={40} color="#E2E8F0" />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>Pick a prompt to fire</div>
                <div style={{ fontSize: 13, color: "#94A3B8" }}>Strategy, SEO, content ideas, objection handlers — all powered by Claude</div>
              </div>
            </div>
          )}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#147EFA", marginBottom: 20 }}>
              <Loader size={16} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Generating — {activeLabel}…</span>
            </div>
          )}

          {response && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 4, height: 16, background: "#147EFA", borderRadius: 2 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{activeLabel}</span>
                </div>
                <button onClick={copy} style={{ display: "flex", alignItems: "center", gap: 5, background: copied ? "#F0FDF4" : "#F8FAFC", border: `1px solid ${copied ? "#BBF7D0" : "#E2E8F0"}`, borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: copied ? "#16A34A" : "#64748B" }}>
                  {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
              <div style={{
                background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px 24px",
                fontSize: 14, lineHeight: 1.7, color: "#334155", whiteSpace: "pre-wrap", flex: 1,
              }}>
                {response}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
