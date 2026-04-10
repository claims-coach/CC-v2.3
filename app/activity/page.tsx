/* @ts-nocheck */
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { Search, CheckSquare, Database, Cpu, Globe, Settings, FileText, Zap, ChevronDown, ChevronRight, Activity } from "lucide-react";

// ── Event type config ──────────────────────────────────────────────────────
const TYPE: Record<string, { icon: any; color: string; bg: string; border: string; label: string; priority: number }> = {
  task:     { icon: CheckSquare, color: "#147EFA", bg: "#eff6ff",  border: "#bfdbfe", label: "Task",     priority: 1 },
  agent:    { icon: Cpu,         color: "#22c55e", bg: "#f0fdf4",  border: "#86efac", label: "Agent",    priority: 2 },
  api:      { icon: Globe,       color: "#f59e0b", bg: "#fffbeb",  border: "#fcd34d", label: "API",      priority: 3 },
  document: { icon: FileText,    color: "#FF8600", bg: "#fff7ed",  border: "#fed7aa", label: "Document", priority: 4 },
  memory:   { icon: Database,    color: "#8b5cf6", bg: "#f5f3ff",  border: "#ddd6fe", label: "Memory",   priority: 5 },
  system:   { icon: Settings,    color: "#64748b", bg: "#f8fafc",  border: "#e2e8f0", label: "System",   priority: 6 },
};

function timeAgo(ts: number) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec/3600)}h ago`;
  return format(ts, "MMM d");
}

function dayLabel(ts: number) {
  if (isToday(ts))     return "Today";
  if (isYesterday(ts)) return "Yesterday";
  return format(ts, "EEEE, MMM d");
}

// ── Grouped entry (collapsed bulk events) ─────────────────────────────────
function GroupRow({ items, expandedGroups, toggleGroup }: {
  items: any[];
  expandedGroups: Set<string>;
  toggleGroup: (key: string) => void;
}) {
  const first = items[0];
  const t = TYPE[first.type] ?? TYPE.system;
  const Icon = t.icon;
  const isBulk = items.length > 1;
  const groupKey = `${first.agentName}-${first.action}-${Math.floor(first.createdAt / 60000)}`;
  const isExpanded = expandedGroups.has(groupKey);
  const isRecent = Date.now() - first.createdAt < 120_000;

  // Extract client name from details if present
  const clientMatch = first.details?.match(/[Cc]lient[:\s]+([A-Z][a-z]+ [A-Z][a-z]+|[A-Z][a-z]+)/);
  const clientName = clientMatch?.[1];

  // Short summary for bulk groups
  const bulkSummary = isBulk
    ? `${items.length}× ${first.action} — ${first.details?.split(":")[0] || first.action}`
    : null;

  return (
    <>
      <div
        onClick={isBulk ? () => toggleGroup(groupKey) : undefined}
        style={{
          display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 14px",
          borderBottom: "1px solid #f1f5f9",
          background: isRecent ? `${t.bg}` : "#fff",
          cursor: isBulk ? "pointer" : "default",
          transition: "background 0.2s",
        }}
      >
        {/* Type indicator stripe */}
        <div style={{ width: 3, borderRadius: 2, alignSelf: "stretch", background: t.color, flexShrink: 0, opacity: 0.6 }} />

        {/* Icon */}
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: t.bg, border: `1px solid ${t.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={13} color={t.color} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{first.agentName}</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>{first.action}</span>
            {isBulk && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
                background: t.bg, border: `1px solid ${t.border}`, color: t.color,
              }}>{items.length}×</span>
            )}
            {isRecent && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #86efac", color: "#16a34a" }}>NEW</span>
            )}
          </div>

          {/* Details — single line, truncated */}
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
            {isBulk ? bulkSummary : first.details}
          </div>

          {/* Meta row */}
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, display: "flex", gap: 10 }}>
            <span>{timeAgo(first.createdAt)}</span>
            {clientName && <span style={{ color: "#147EFA" }}>● {clientName}</span>}
            {isBulk && <span style={{ color: t.color }}>click to {isExpanded ? "collapse" : "expand"}</span>}
          </div>
        </div>

        {/* Expand chevron for bulk */}
        {isBulk && (
          <div style={{ color: "#94a3b8", flexShrink: 0 }}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
      </div>

      {/* Expanded bulk items */}
      {isBulk && isExpanded && items.map((item, i) => (
        <div key={item._id || i} style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          padding: "6px 14px 6px 55px",
          borderBottom: "1px solid #f8fafc",
          background: "#fafafa",
        }}>
          <div style={{ width: 3, borderRadius: 2, alignSelf: "stretch", background: t.color, flexShrink: 0, opacity: 0.3 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.4 }}>{item.details || item.action}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
              {format(item.createdAt, "h:mm:ss a")}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ActivityPage() {
  const activity = useQuery(api.activity.list, {}) ?? [];
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Unique agents for filter
  const agents = useMemo(() => {
    const names = [...new Set(activity.map((a: any) => a.agentName))];
    return names.sort();
  }, [activity]);

  // Filter
  const filtered = useMemo(() => {
    let items = activity;
    if (typeFilter !== "all") items = items.filter((a: any) => a.type === typeFilter);
    if (agentFilter !== "all") items = items.filter((a: any) => a.agentName === agentFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((a: any) =>
        a.agentName?.toLowerCase().includes(q) ||
        a.action?.toLowerCase().includes(q) ||
        a.details?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [activity, typeFilter, agentFilter, search]);

  // Group into day buckets, then collapse same-agent/same-action bursts within 60s
  const grouped = useMemo(() => {
    const days: { label: string; ts: number; groups: any[][] }[] = [];
    let currentDay = "";
    let currentDayGroups: any[][] = [];
    let currentBurst: any[] = [];

    for (let i = 0; i < filtered.length; i++) {
      const item = filtered[i];
      const prev = filtered[i - 1];
      const day = format(item.createdAt, "yyyy-MM-dd");

      // New day boundary
      if (day !== currentDay) {
        if (currentBurst.length > 0) { currentDayGroups.push(currentBurst); currentBurst = []; }
        if (currentDayGroups.length > 0) days.push({ label: dayLabel(new Date(currentDay).getTime()), ts: new Date(currentDay).getTime(), groups: currentDayGroups });
        currentDay = day;
        currentDayGroups = [];
      }

      // Group same agent+action within 90s window
      const sameGroup = prev &&
        item.agentName === prev.agentName &&
        item.action === prev.action &&
        item.type === prev.type &&
        Math.abs(item.createdAt - prev.createdAt) < 90_000;

      if (sameGroup) {
        currentBurst.push(item);
      } else {
        if (currentBurst.length > 0) currentDayGroups.push(currentBurst);
        currentBurst = [item];
      }
    }

    if (currentBurst.length > 0) currentDayGroups.push(currentBurst);
    if (currentDayGroups.length > 0) days.push({ label: dayLabel(new Date(currentDay).getTime()), ts: new Date(currentDay).getTime(), groups: currentDayGroups });

    return days;
  }, [filtered]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activity.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
    return counts;
  }, [activity]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 24px 12px", borderBottom: "1px solid #e2e8f0", flexShrink: 0, background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>Activity Feed</h1>
            <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>
              {activity.length} events · {filtered.length} shown · real-time
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 20 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 4px #22c55e88" }} />
            <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>Live</span>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={14} color="#94a3b8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events, clients, agents…"
            style={{
              width: "100%", padding: "8px 12px 8px 32px",
              border: "1px solid #e2e8f0", borderRadius: 8,
              fontSize: 12, color: "#0f172a", outline: "none",
              boxSizing: "border-box", background: "#f8fafc",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14,
            }}>×</button>
          )}
        </div>

        {/* Filter row */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {/* Type filters */}
          <button
            onClick={() => setTypeFilter("all")}
            style={{
              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: typeFilter === "all" ? 700 : 500,
              background: typeFilter === "all" ? "#0f172a" : "#f1f5f9",
              color: typeFilter === "all" ? "#fff" : "#64748b",
              border: "none", cursor: "pointer",
            }}
          >All ({activity.length})</button>

          {Object.entries(TYPE)
            .sort((a, b) => a[1].priority - b[1].priority)
            .filter(([key]) => typeCounts[key])
            .map(([key, cfg]) => (
              <button key={key}
                onClick={() => setTypeFilter(typeFilter === key ? "all" : key)}
                style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: typeFilter === key ? 700 : 500,
                  background: typeFilter === key ? cfg.color : cfg.bg,
                  color: typeFilter === key ? "#fff" : cfg.color,
                  border: `1px solid ${cfg.border}`, cursor: "pointer",
                }}
              >{cfg.label} ({typeCounts[key] || 0})</button>
            ))}

          {/* Agent filter */}
          {agents.length > 1 && (
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              style={{
                marginLeft: 4, padding: "3px 8px", borderRadius: 8, fontSize: 11,
                border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer",
              }}
            >
              <option value="all">All agents</option>
              {agents.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── Feed ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "#94a3b8" }}>
            <Activity size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14, margin: 0 }}>
              {search || typeFilter !== "all" ? "No events match your filters." : "No activity yet."}
            </p>
            {(search || typeFilter !== "all") && (
              <button onClick={() => { setSearch(""); setTypeFilter("all"); setAgentFilter("all"); }}
                style={{ marginTop: 10, padding: "6px 14px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, color: "#64748b", cursor: "pointer" }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          grouped.map(day => (
            <div key={day.label}>
              {/* Day header */}
              <div style={{
                padding: "8px 16px", fontSize: 10, fontWeight: 700, color: "#94a3b8",
                textTransform: "uppercase", letterSpacing: 0.8,
                background: "#f8fafc", borderBottom: "1px solid #f1f5f9",
                position: "sticky", top: 0, zIndex: 10,
              }}>
                {day.label}
                <span style={{ marginLeft: 8, fontWeight: 400 }}>({day.groups.length} events{day.groups.length !== day.groups.reduce((s, g) => s + g.length, 0) ? ` / ${day.groups.reduce((s, g) => s + g.length, 0)} entries` : ""})</span>
              </div>

              {day.groups.map((group, gi) => (
                <GroupRow
                  key={gi}
                  items={group}
                  expandedGroups={expandedGroups}
                  toggleGroup={toggleGroup}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
