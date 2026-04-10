"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { Plus, RefreshCw, Clock, CalendarDays, User, Video } from "lucide-react";

const CALENDAR_NAMES: Record<string, string> = {
  LbMYTNHF582imp0fx7bw: "Appraisal Consult",
  YTYwvLvWaO0WAMgwHVSp: "$200 1-on-1",
  uOYapA76JzNhuVBDRpRu: "$200 1-on-1",
};

const APPT_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  confirmed:  { bg: "#052e16", text: "#22c55e" },
  cancelled:  { bg: "#2a0a0a", text: "#ef4444" },
  pending:    { bg: "#2a1a00", text: "#f59e0b" },
  showed:     { bg: "#052e16", text: "#22c55e" },
  no_show:    { bg: "#1a1a2a", text: "#94a3b8" },
  inprogress: { bg: "#0a1a2a", text: "#3b82f6" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TYPE_COLOR: Record<string, string> = { cron: "#147EFA", task: "#3b82f6", event: "#22c55e" };
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: "#EFF6FF", text: "#3b82f6" },
  running:   { bg: "#2a1a00", text: "#f59e0b" },
  completed: { bg: "#052e16", text: "#22c55e" },
  failed:    { bg: "#2a0a0a", text: "#ef4444" },
};
const S = { background: "#FFFFFF", border: "1px solid #252525", color: "#334155", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none" };

export default function CalendarPage() {
  const items = useQuery(api.calendar.list);
  const consultations = useQuery(api.ghlCalendar.listUpcoming);
  const create = useMutation(api.calendar.create);
  const log    = useMutation(api.activity.log);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", type: "cron" as const, cronExpression: "", scheduledAt: "", assignee: "CC", description: "" });
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), weekOffset * 7);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const submit = async () => {
    if (!f.title.trim()) return;
    await create({ title: f.title, description: f.description || undefined, type: f.type, scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).getTime() : Date.now(), cronExpression: f.cronExpression || undefined, status: "scheduled", assignee: f.assignee });
    await log({ agentName: "CC", action: `Scheduled: ${f.title}`, type: "system" });
    setOpen(false);
    setF({ title: "", type: "cron", cronExpression: "", scheduledAt: "", assignee: "CC", description: "" });
  };

  const getItemsForDay = (day: Date) =>
    items?.filter(item => {
      if (item.cronExpression) {
        const expr = item.cronExpression;
        if (expr === "0 7 * * *" || expr === "0 7 * * * (America/Los_Angeles)") return true;
        if (expr === "0 8 * * *" || expr === "0 8 * * * (America/Los_Angeles)") return true;
        return false;
      }
      return isSameDay(new Date(item.scheduledAt), day);
    }) ?? [];

  const allCrons = items?.filter(i => i.cronExpression) ?? [];
  const oneTime  = items?.filter(i => !i.cronExpression) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 32px 20px", borderBottom: "1px solid #FFFFFF", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#334155", margin: 0 }}>Calendar</h1>
          <p style={{ fontSize: 12, color: "#444", margin: "4px 0 0" }}>{items?.length ?? 0} scheduled items</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: "#FFFFFF", border: "1px solid #1e1e1e", color: "#888", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>←</button>
            <button onClick={() => setWeekOffset(0)} style={{ background: "#FFFFFF", border: "1px solid #1e1e1e", color: "#888", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Today</button>
            <button onClick={() => setWeekOffset(o => o + 1)} style={{ background: "#FFFFFF", border: "1px solid #1e1e1e", color: "#888", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>→</button>
          </div>
          <button onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            <Plus size={14} /> Schedule
          </button>
        </div>
      </div>

      {open && (
        <div style={{ margin: "16px 32px 0", padding: 20, background: "#F8FAFC", border: "1px solid #222", borderRadius: 12, flexShrink: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input style={{ ...S, gridColumn: "1/-1" }} placeholder="Title..." value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus />
            <select style={S} value={f.type} onChange={e => setF({ ...f, type: e.target.value as any })}>
              <option value="cron">Cron Job</option><option value="task">Task</option><option value="event">Event</option>
            </select>
            <input style={S} placeholder="Cron expression (e.g. 0 9 * * 1)" value={f.cronExpression} onChange={e => setF({ ...f, cronExpression: e.target.value })} />
            <input type="datetime-local" style={S} value={f.scheduledAt} onChange={e => setF({ ...f, scheduledAt: e.target.value })} />
            <input style={S} placeholder="Assignee" value={f.assignee} onChange={e => setF({ ...f, assignee: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={submit} style={{ background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Add</button>
            <button onClick={() => setOpen(false)} style={{ background: "#CBD5E1", color: "#888", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: "20px 32px 24px" }}>
        {/* Upcoming GHL Consultations */}
        {consultations !== undefined && (
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Upcoming Consultations ({consultations.length})
            </p>
            {consultations.length === 0 ? (
              <div style={{ padding: "16px 20px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, color: "#94A3B8", fontSize: 13 }}>
                No upcoming consultations in the next 7 days.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {consultations.map(ev => {
                  const statusKey = (ev.appointmentStatus || ev.status || 'confirmed').toLowerCase();
                  const statusStyle = APPT_STATUS_STYLE[statusKey] || APPT_STATUS_STYLE.confirmed;
                  const calLabel = CALENDAR_NAMES[ev.calendarId] || ev.calendarName || ev.calendarId;
                  return (
                    <div key={ev._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#FFFFFF", border: "1px solid #1a1a1a", borderRadius: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "#0a1a2a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Video size={14} color="#3b82f6" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#334155", margin: 0 }}>
                          {ev.contactName || ev.title || "Consultation"}
                        </p>
                        <p style={{ fontSize: 11, color: "#64748B", margin: "3px 0 0" }}>
                          📅 {format(new Date(ev.startTime), "EEE MMM d · h:mm a")} · {calLabel}
                        </p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 5, ...statusStyle }}>
                        {statusKey}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Weekly grid */}
        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Week of {format(weekStart, "MMM d, yyyy")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: 32 }}>
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, new Date());
            const dayItems = getItemsForDay(day);
            return (
              <div key={i} style={{ background: "#FFFFFF", border: `1px solid ${isToday ? "#147EFA" : "#E2E8F0"}`, borderRadius: 10, padding: 12, minHeight: 100 }}>
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 11, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{DAYS[i]}</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: isToday ? "#147EFA" : "#334155", margin: "2px 0 0" }}>{format(day, "d")}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {dayItems.map(item => (
                    <div key={item._id} style={{ fontSize: 10, padding: "3px 6px", borderRadius: 4, background: "#FFFFFF", color: TYPE_COLOR[item.type], borderLeft: `2px solid ${TYPE_COLOR[item.type]}`, lineHeight: 1.3 }}>
                      {item.cronExpression ? "🔁 " : ""}{item.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cron jobs section */}
        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Recurring Cron Jobs</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {allCrons.map(item => (
            <div key={item._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#FFFFFF", border: "1px solid #1a1a1a", borderRadius: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <RefreshCw size={14} color="#147EFA" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#334155", margin: 0 }}>{item.title}</p>
                <p style={{ fontSize: 11, color: "#444", margin: "3px 0 0" }}>⏰ {item.cronExpression} · {item.assignee}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 5, ...STATUS_STYLE[item.status] }}>{item.status}</span>
            </div>
          ))}
          {allCrons.length === 0 && <p style={{ fontSize: 13, color: "#94A3B8", padding: "16px 0" }}>No recurring jobs yet.</p>}
        </div>

        {/* One-time */}
        {oneTime.length > 0 && (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>One-Time Events</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {oneTime.map(item => (
                <div key={item._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#FFFFFF", border: "1px solid #1a1a1a", borderRadius: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#0a2a1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Clock size={14} color="#22c55e" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#334155", margin: 0 }}>{item.title}</p>
                    <p style={{ fontSize: 11, color: "#444", margin: "3px 0 0" }}>{format(item.scheduledAt, "MMM d, yyyy · h:mm a")} · {item.assignee}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 5, ...STATUS_STYLE[item.status] }}>{item.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
