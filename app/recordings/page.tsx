"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
import { Mic, Search, Calendar, TrendingUp, Clock, User, Tag } from "lucide-react";
import { format } from "date-fns";

// ── Category config ────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  claims_coach:    { label: "Claims.Coach",    color: "#147EFA", bg: "#eff6ff", border: "#bfdbfe" },
  walker_appraisal:{ label: "Walker Appraisal",color: "#0f172a", bg: "#f1f5f9", border: "#cbd5e1" },
  mas_solutions:   { label: "MAS Solutions",   color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  reca:            { label: "RECA",            color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  church:          { label: "Church",          color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  personal:        { label: "Personal",        color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  uncategorized:   { label: "Uncategorized",   color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
};

function CategoryBadge({ category }: { category?: string }) {
  const cat  = category && CATEGORY_META[category] ? category : "uncategorized";
  const meta = CATEGORY_META[cat];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 20,
      fontSize: 10,
      fontWeight: 700,
      color: meta.color,
      background: meta.bg,
      border: `1px solid ${meta.border}`,
      whiteSpace: "nowrap",
    }}>
      {meta.label}
    </span>
  );
}

// ── Bar chart ──────────────────────────────────────────────────────────────
function BarChart({
  data, labelFn, color = "#147EFA", barWidth = 16, height = 80, showLabels = true,
}: {
  data: [string, number][];
  labelFn?: (key: string) => string;
  color?: string;
  barWidth?: number;
  height?: number;
  showLabels?: boolean;
}) {
  const max = Math.max(...data.map(d => d[1]), 1);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: height + 28, paddingBottom: 24, position: "relative", overflow: "hidden" }}>
      {data.map(([key, val], i) => {
        const barH = Math.max(val > 0 ? 4 : 2, (val / max) * height);
        const isHovered = hovered === i;
        const label = labelFn ? labelFn(key) : key.slice(-5);
        return (
          <div
            key={key}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, position: "relative" }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {isHovered && (
              <div style={{
                position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
                background: "#0f172a", color: "#fff", fontSize: 10, fontWeight: 700,
                padding: "3px 6px", borderRadius: 4, whiteSpace: "nowrap", zIndex: 10, marginBottom: 4,
              }}>
                {val} {val === 1 ? "note" : "notes"}
                <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 400 }}>{key}</div>
              </div>
            )}
            <div style={{
              width: barWidth,
              height: barH,
              background: val === 0 ? "#e2e8f0" : isHovered ? "#FF8600" : color,
              borderRadius: `${barWidth/3}px ${barWidth/3}px 0 0`,
              transition: "height 0.4s ease, background 0.2s",
              cursor: "default",
            }} />
            {showLabels && (
              <div style={{ fontSize: 8, color: "#94a3b8", transform: "rotate(-30deg)", whiteSpace: "nowrap", marginTop: 2 }}>{label}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Stat tile ──────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, color = "#0f172a", icon }: {
  label: string; value: number | string; sub?: string; color?: string; icon: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: "#94a3b8" }}>{sub}</div>}
      </div>
    </div>
  );
}

function fmtDuration(sec?: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function RecordingsPage() {
  const stats   = useQuery(api.recordings.stats);
  const all     = useQuery(api.recordings.list, {}) ?? [];
  const [view,       setView]       = useState<"day" | "week" | "month">("day");
  const [search,     setSearch]     = useState("");
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [catFilter,  setCatFilter]  = useState<string>("all");
  const [syncing,    setSyncing]    = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Chart data sorted oldest → newest
  const chartData: [string, number][] = useMemo(() => {
    if (!stats) return [];
    const raw =
      view === "day"   ? stats.daily   :
      view === "week"  ? stats.weekly  :
                         stats.monthly;
    return Object.entries(raw).sort((a, b) => a[0].localeCompare(b[0]));
  }, [stats, view]);

  const labelFn = (key: string) => {
    if (view === "day")  return format(new Date(key + "T12:00:00"), "M/d");
    if (view === "week") return format(new Date(key + "T12:00:00"), "MMM d");
    return format(new Date(key + "-01T12:00:00"), "MMM yy");
  };

  // Category counts
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: all.length };
    for (const r of all) {
      const cat = (r as any).category || "uncategorized";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [all]);

  // Filter recordings
  const filtered = useMemo(() => {
    let list = all;
    if (catFilter !== "all") {
      list = list.filter(r => {
        const cat = (r as any).category || "uncategorized";
        return cat === catFilter;
      });
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(r =>
      r.title?.toLowerCase().includes(q) ||
      r.clientName?.toLowerCase().includes(q) ||
      r.transcript?.toLowerCase().includes(q) ||
      r.summary?.toLowerCase().includes(q)
    );
  }, [all, search, catFilter]);

  const barWidth = view === "month" ? 28 : view === "week" ? 20 : 12;

  // Category tabs — only show tabs that have recordings (or "all")
  const visibleCats = useMemo(() => {
    const keys = ["all", ...Object.keys(CATEGORY_META)];
    return keys.filter(k => k === "all" || (catCounts[k] || 0) > 0);
  }, [catCounts]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 24px 14px", borderBottom: "1px solid #e2e8f0", background: "#fff", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mic size={16} color="#FF8600" />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>Notes</h1>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{all.length} total · Plaud + Gemini Notes · synced hourly from Gmail</p>
            </div>
          </div>
          {/* Sync button */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {syncResult && (
              <span style={{ fontSize: 12, color: syncResult.startsWith("✓") ? "#16a34a" : "#ef4444", fontWeight: 600 }}>{syncResult}</span>
            )}
            <button
              onClick={async () => {
                setSyncing(true); setSyncResult(null);
                try {
                  const r = await fetch("/api/ingest-gemini-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lookbackHours: 48 }) });
                  const d = await r.json();
                  if (d.error) setSyncResult("✗ " + d.error);
                  else setSyncResult(`✓ ${d.processed} note${d.processed !== 1 ? "s" : ""} processed`);
                } catch (e: any) { setSyncResult("✗ " + e.message); }
                setSyncing(false);
              }}
              disabled={syncing}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer", opacity: syncing ? 0.7 : 1 }}
            >
              {syncing ? "Syncing…" : "⚡ Sync Notes"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ── Stats tiles ─────────────────────────────────────────────── */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
            <StatTile label="Total"      value={stats.total}  sub="all time"       color="#0f172a"  icon={<Mic size={17} />} />
            <StatTile label="Today"      value={stats.today}  sub="since midnight" color="#147EFA"  icon={<Clock size={17} />} />
            <StatTile label="This Week"  value={stats.week}   sub="last 7 days"    color="#8b5cf6"  icon={<Calendar size={17} />} />
            <StatTile label="This Month" value={stats.month}  sub={format(new Date(), "MMMM")} color="#FF8600" icon={<TrendingUp size={17} />} />
            <StatTile label="This Year"  value={stats.year}   sub={String(new Date().getFullYear())} color="#16a34a" icon={<TrendingUp size={17} />} />
          </div>
        )}

        {/* ── Chart ────────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Notes Processed</span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["day","week","month"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: view === v ? 700 : 500,
                  background: view === v ? "#0f172a" : "#f1f5f9",
                  color: view === v ? "#fff" : "#64748b",
                  border: "none", cursor: "pointer",
                }}>
                  {v === "day" ? "Daily" : v === "week" ? "Weekly" : "Monthly"}
                </button>
              ))}
            </div>
          </div>

          {chartData.length === 0 ? (
            <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>
              No data yet
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: chartData.length * (barWidth + 3), paddingLeft: 4 }}>
                <BarChart data={chartData} labelFn={labelFn} color="#147EFA" barWidth={barWidth} height={100} />
              </div>
            </div>
          )}

          {stats && (
            <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>By Source</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(stats.bySource).map(([src, n]) => (
                    <div key={src} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: (src === "plaud" || src === "manual") ? "#eff6ff" : src === "upload" ? "#fff7ed" : "#f0fdf4",
                      color: (src === "plaud" || src === "manual") ? "#147EFA" : src === "upload" ? "#FF8600" : "#16a34a",
                      border: `1px solid ${(src === "plaud" || src === "manual") ? "#bfdbfe" : src === "upload" ? "#fed7aa" : "#bbf7d0"}`,
                    }}>
                      {src} · {n}
                    </div>
                  ))}
                </div>
              </div>
              {stats.topClients.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Top Clients</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {stats.topClients.map(([name, n]) => (
                      <div key={name} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569" }}>
                        {name} · {n}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Recording list ────────────────────────────────────────────── */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>

          {/* Category filter tabs */}
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {visibleCats.map(cat => {
              const isActive = catFilter === cat;
              const meta = cat === "all" ? null : CATEGORY_META[cat];
              const count = catCounts[cat] || 0;
              return (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    border: isActive
                      ? `2px solid ${meta?.color ?? "#0f172a"}`
                      : "1px solid #e2e8f0",
                    background: isActive ? (meta?.bg ?? "#f1f5f9") : "#fff",
                    color: isActive ? (meta?.color ?? "#0f172a") : "#64748b",
                    transition: "all 0.15s",
                  }}
                >
                  {cat === "all" ? "All" : (meta?.label ?? cat)} {count > 0 && <span style={{ opacity: 0.7 }}>· {count}</span>}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={14} color="#94a3b8" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search recordings by title, client, or transcript…"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 12, color: "#334155", background: "transparent" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>×</button>
            )}
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{filtered.length} of {all.length}</span>
          </div>

          {/* List */}
          <div>
            {filtered.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                {search || catFilter !== "all" ? "No recordings match your filters." : "No recordings yet."}
              </div>
            ) : (
              filtered.map((rec, i) => {
                const isOpen   = expanded === rec._id;
                const srcColor = (rec.source === "plaud" || rec.source === "manual") ? "#147EFA" : rec.source === "upload" ? "#FF8600" : "#16a34a";
                const recCat   = (rec as any).category;
                return (
                  <div key={rec._id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    {/* Row */}
                    <div
                      onClick={() => setExpanded(isOpen ? null : rec._id)}
                      style={{
                        padding: "11px 16px", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 12,
                        background: isOpen ? "#f8fafc" : "#fff",
                        transition: "background 0.15s",
                      }}
                    >
                      {/* Source dot */}
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: srcColor, flexShrink: 0 }} />

                      {/* Main */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {rec.title}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", gap: 10, marginTop: 2, alignItems: "center", flexWrap: "wrap" }}>
                          {rec.clientName && <span style={{ color: "#147EFA" }}><User size={9} style={{ display: "inline", marginRight: 3 }} />{rec.clientName}</span>}
                          {rec.duration   && <span><Clock size={9} style={{ display: "inline", marginRight: 3 }} />{fmtDuration(rec.duration)}</span>}
                          {rec.tags?.slice(0, 3).map(t => <span key={t}><Tag size={9} style={{ display: "inline", marginRight: 2 }} />{t}</span>)}
                          {recCat && <CategoryBadge category={recCat} />}
                        </div>
                      </div>

                      {/* Right */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: srcColor, textTransform: "uppercase" }}>{rec.source}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>
                          {format(rec.createdAt, "MMM d, h:mm a")}
                        </div>
                      </div>
                    </div>

                    {/* Expanded */}
                    {isOpen && (
                      <div style={{ padding: "0 16px 14px 36px", background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
                        {recCat && (
                          <div style={{ marginTop: 10, marginBottom: 4 }}>
                            <CategoryBadge category={recCat} />
                          </div>
                        )}
                        {rec.summary && (
                          <div style={{ marginTop: 8, fontSize: 12, color: "#334155", lineHeight: 1.6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "10px 12px", marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <strong style={{ fontSize: 10, textTransform: "uppercase", color: "#94a3b8", letterSpacing: 0.5 }}>Summary</strong>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(rec.summary);
                                  alert("Summary copied!");
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#147EFA", fontWeight: 500, padding: "2px 4px" }}
                                title="Copy summary"
                              >
                                📋 Copy
                              </button>
                            </div>
                            {rec.summary}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, maxHeight: 120, overflow: "auto",
                          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 12px",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <strong style={{ fontSize: 10, textTransform: "uppercase", color: "#94a3b8", letterSpacing: 0.5 }}>Transcript</strong>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(rec.transcript);
                                alert("Transcript copied!");
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#147EFA", fontWeight: 500, padding: "2px 4px" }}
                              title="Copy transcript"
                            >
                              📋 Copy
                            </button>
                          </div>
                          {rec.transcript.slice(0, 600)}{rec.transcript.length > 600 ? "…" : ""}
                        </div>
                        {rec.driveUrl && (
                          <a href={rec.driveUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: "#147EFA" }}>
                            Open in Drive ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
