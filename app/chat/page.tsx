"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Loader, RotateCcw } from "lucide-react";

type Role = "user" | "assistant";
interface Msg { id: string; role: Role; content: string; ts: number; streaming?: boolean; }

const uid = () => Math.random().toString(36).slice(2);

const fmt = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: isUser ? "row-reverse" : "row" }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: isUser ? "linear-gradient(135deg,#5e6ad2,#8b5cf6)" : "#FFFFFF",
        border: isUser ? "none" : "1px solid #222",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {isUser
          ? <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>J</span>
          : <span style={{ fontSize: 14 }}>🧠</span>}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 4 }}>
        <div style={{
          padding: "10px 14px",
          borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
          background: isUser ? "#147EFA" : "#111",
          border: isUser ? "none" : "1px solid #1e1e1e",
          fontSize: 14,
          lineHeight: 1.6,
          color: isUser ? "#fff" : "#334155",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {msg.content || (msg.streaming ? "" : "…")}
          {msg.streaming && (
            <span style={{ display: "inline-block", width: 8, height: 14, background: "#147EFA", borderRadius: 1, marginLeft: 3, verticalAlign: "text-bottom", animation: "blink 0.8s step-end infinite" }} />
          )}
        </div>
        <span style={{ fontSize: 10, color: "#94A3B8" }}>{fmt(msg.ts)}</span>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: uid(), role: "assistant", content: "Hey Johnny. What do you need?", ts: Date.now() },
  ]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Msg = { id: uid(), role: "user", content: text, ts: Date.now() };
    const assistantId = uid();
    const assistantMsg: Msg = { id: assistantId, role: "assistant", content: "", ts: Date.now(), streaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    // Build history for context (last 20 messages)
    const history = [...messages.slice(-20), userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const delta  = parsed.choices?.[0]?.delta?.content ?? "";
            full += delta;
            setMessages(prev =>
              prev.map(m => m.id === assistantId ? { ...m, content: full } : m)
            );
          } catch {}
        }
      }

      // Mark done
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: full || "…", streaming: false } : m)
      );
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m => m.id === assistantId
          ? { ...m, content: `Error: ${err.message}`, streaming: false }
          : m
        )
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clear = () => {
    setMessages([{ id: uid(), role: "assistant", content: "Hey Johnny. What do you need?", ts: Date.now() }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid #FFFFFF", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F8FAFC", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧠</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#334155", margin: 0 }}>CC — Chief of Staff</p>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: 11, color: "#22c55e" }}>Connected · OpenClaw gateway</span>
            </div>
          </div>
        </div>
        <button onClick={clear} title="Clear chat" style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFFFFF", border: "1px solid #1e1e1e", color: "#64748B", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#aaa"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#555"}>
          <RotateCcw size={12} /> New chat
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
        {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "16px 32px 24px", borderTop: "1px solid #FFFFFF", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "#FFFFFF", border: `1px solid ${loading ? "#5e6ad244" : "#E2E8F0"}`, borderRadius: 12, padding: "12px 14px", transition: "border 0.15s" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
            }}
            onKeyDown={onKey}
            placeholder="Message CC… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={loading}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "#334155", fontSize: 14, lineHeight: 1.5, resize: "none",
              fontFamily: "inherit", minHeight: 24, maxHeight: 180,
              opacity: loading ? 0.6 : 1,
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            style={{
              width: 34, height: 34, borderRadius: 8, border: "none",
              background: loading || !input.trim() ? "#CBD5E1" : "#147EFA",
              color: loading || !input.trim() ? "#333" : "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: loading || !input.trim() ? "default" : "pointer",
              flexShrink: 0, transition: "all 0.15s",
            }}>
            {loading
              ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />
              : <Send size={14} strokeWidth={2.5} />}
          </button>
        </div>
        <p style={{ fontSize: 10, color: "#CBD5E1", margin: "8px 0 0", textAlign: "center" }}>
          Messages route to your live OpenClaw session · context carries across this chat
        </p>
      </div>

      <style>{`
        @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0 } }
        @keyframes spin  { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>
    </div>
  );
}
