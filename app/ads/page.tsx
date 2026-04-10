"use client";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList } from "recharts";

const mockSpendTrend = [
  { date: "Mar 1", spend: 120, leads: 2 },
  { date: "Mar 3", spend: 150, leads: 3 },
  { date: "Mar 5", spend: 180, leads: 4 },
  { date: "Mar 7", spend: 140, leads: 3 },
  { date: "Mar 9", spend: 200, leads: 5 },
  { date: "Mar 11", spend: 250, leads: 6 },
  { date: "Mar 13", spend: 180, leads: 4 },
  { date: "Mar 15", spend: 220, leads: 5 },
  { date: "Mar 17", spend: 190, leads: 4 },
  { date: "Mar 19", spend: 240, leads: 6 },
  { date: "Mar 21", spend: 210, leads: 5 },
  { date: "Mar 23", spend: 260, leads: 6 },
  { date: "Mar 25", spend: 177, leads: 4 },
];

const mockFunnel = [
  { name: "Leads Generated", value: 34 },
  { name: "Qualified", value: 22 },
  { name: "Clients", value: 8 },
  { name: "Closed", value: 6 },
];

const mockCampaigns = [
  { name: "DV-Claims-Q1", spend: 1200, leads: 15, roi: "320%", ctr: "3.1%", cpl: 80, status: "winning" },
  { name: "Loss-Use-Q1", spend: 847, leads: 9, roi: "180%", ctr: "2.1%", cpl: 94, status: "watch" },
  { name: "ACV-Disputes", spend: 500, leads: 7, roi: "280%", ctr: "4.2%", cpl: 71, status: "good" },
  { name: "Rebranding-DV", spend: 300, leads: 3, roi: "0%", ctr: "1.8%", cpl: 100, status: "pause" },
];

const mockPlatforms = [
  { name: "Facebook", value: 1500 },
  { name: "Google", value: 1347 },
];

const mockLeadQuality = [
  { name: "High", value: 14 },
  { name: "Medium", value: 13 },
  { name: "Low", value: 7 },
];

const COLORS = ["#22c55e", "#f59e0b", "#ef4444"];
const platformColors = ["#1f2937", "#0f172a"];

export default function AdsPage() {
  const totalSpend = 2847;
  const totalLeads = 34;
  const costPerLead = 83.73;
  const roi = 238;
  const topCampaign = mockCampaigns[0];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0 }}>
          📊 Ads Performance
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
          Facebook & Google Ads • This Month • Real-time tracking
        </p>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        
        {/* TOP METRICS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Total Spend", val: `$${totalSpend.toLocaleString()}`, color: "#3b82f6" },
            { label: "Leads Generated", val: totalLeads.toString(), color: "#22c55e" },
            { label: "Cost Per Lead", val: `$${costPerLead.toFixed(2)}`, color: "#f59e0b" },
            { label: "ROI", val: `${roi}%`, color: "#a78bfa" },
          ].map((m) => (
            <div key={m.label} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <p style={{ fontSize: 32, fontWeight: 800, color: m.color, margin: "0 0 8px 0" }}>
                {m.val}
              </p>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{m.label}</p>
            </div>
          ))}
        </div>

        {/* SPEND & LEADS TREND */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px", marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0" }}>
            Daily Spend vs Leads (30 days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockSpendTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9" }}
                formatter={(val) => typeof val === "number" ? val.toFixed(2) : val}
              />
              <Legend />
              <Line type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={2} dot={false} name="Spend ($)" />
              <Line type="monotone" dataKey="leads" stroke="#22c55e" strokeWidth={2} dot={false} name="Leads" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* PLATFORM COMPARISON */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { platform: "Facebook", spend: 1500, leads: 18, cpl: 83.33, ctr: "3.2%", roi: "312%", status: "🟢 WINNING" },
            { platform: "Google Ads", spend: 1347, leads: 16, cpl: 84.19, ctr: "2.8%", roi: "168%", status: "🟡 WATCH" },
          ].map((p) => (
            <div key={p.platform} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>{p.platform}</h3>
                <span style={{ fontSize: 12, fontWeight: 700, color: p.status.includes("WINNING") ? "#22c55e" : "#f59e0b" }}>
                  {p.status}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 4px 0" }}>Spend</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#3b82f6", margin: 0 }}>
                    ${p.spend.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 4px 0" }}>Leads</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#22c55e", margin: 0 }}>{p.leads}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 4px 0" }}>Cost/Lead</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", margin: 0 }}>
                    ${p.cpl.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 4px 0" }}>CTR</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#a78bfa", margin: 0 }}>{p.ctr}</p>
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
                <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 4px 0" }}>ROI</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: p.roi.includes("312") ? "#22c55e" : "#f59e0b", margin: 0 }}>
                  {p.roi}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CAMPAIGNS TABLE */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px", marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0" }}>Campaign Breakdown</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "12px 8px", color: "#64748b", fontWeight: 600 }}>Campaign</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", color: "#64748b", fontWeight: 600 }}>Spend</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", color: "#64748b", fontWeight: 600 }}>Leads</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", color: "#64748b", fontWeight: 600 }}>Cost/Lead</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", color: "#64748b", fontWeight: 600 }}>CTR</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", color: "#64748b", fontWeight: 600 }}>ROI</th>
                  <th style={{ textAlign: "center", padding: "12px 8px", color: "#64748b", fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {mockCampaigns.map((c, i) => {
                  const statusColors: Record<string, string> = { winning: "#22c55e", watch: "#f59e0b", good: "#3b82f6", pause: "#ef4444" };
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 8px", color: "#0f172a", fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: "12px 8px", color: "#64748b", textAlign: "right" }}>${c.spend}</td>
                      <td style={{ padding: "12px 8px", color: "#64748b", textAlign: "right" }}>{c.leads}</td>
                      <td style={{ padding: "12px 8px", color: "#64748b", textAlign: "right" }}>${c.cpl}</td>
                      <td style={{ padding: "12px 8px", color: "#64748b", textAlign: "right" }}>{c.ctr}</td>
                      <td style={{ padding: "12px 8px", color: "#64748b", textAlign: "right", fontWeight: 600 }}>{c.roi}</td>
                      <td style={{ padding: "12px 8px", textAlign: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: statusColors[c.status], textTransform: "uppercase" }}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* LEAD FUNNEL */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px", marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0" }}>Lead Conversion Funnel (30 days)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <FunnelChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9" }} />
              <Funnel dataKey="value" data={mockFunnel} fill="#3b82f6">
                <LabelList dataKey="name" position="right" />
                {mockFunnel.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={["#22c55e", "#3b82f6", "#f59e0b", "#a78bfa"][index]} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              📌 <strong>Action:</strong> Only 36% of qualified leads convert to clients. Test better follow-up sequences to improve this.
            </p>
          </div>
        </div>

        {/* SPEND ALLOCATION & LEAD QUALITY */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 32 }}>
          {/* Platform Pie */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0" }}>Spend by Platform</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={mockPlatforms} cx="50%" cy="50%" labelLine={false} label={(entry) => `${entry.name}`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {mockPlatforms.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={platformColors[index]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => `$${val}`} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 12, textAlign: "center", fontSize: 11, color: "#64748b" }}>
              Facebook 53% | Google 47%
            </div>
          </div>

          {/* Lead Quality Pie */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0" }}>Lead Quality Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={mockLeadQuality} cx="50%" cy="50%" labelLine={false} label={(entry) => `${entry.name}`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {mockLeadQuality.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 12, textAlign: "center", fontSize: 11, color: "#64748b" }}>
              High 41% | Medium 38% | Low 21%
            </div>
          </div>
        </div>

        {/* AI RECOMMENDATIONS */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px", marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0" }}>🤖 AI Feedback & Recommendations</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(1, 1fr)", gap: 12 }}>
            {[
              { icon: "🔴", text: "PAUSE: Rebranding-DV campaign (0% ROI after 1 month). Cut losses now.", color: "#ef4444" },
              { icon: "🟡", text: "WATCH: Loss-Use underperforming at $94/lead. Test new copy variants vs current control.", color: "#f59e0b" },
              { icon: "🟢", text: "SCALE: DV-Claims-Q1 is your winner (320% ROI). Increase daily budget by 30% to $40.", color: "#22c55e" },
              { icon: "💡", text: "ACTION: Qualified→Client conversion is only 36%. Try 24h auto-follow-up calls for hot leads.", color: "#3b82f6" },
            ].map((rec, i) => (
              <div key={i} style={{ padding: "12px 16px", background: "#f8fafc", border: `1px solid #e2e8f0`, borderRadius: 8 }}>
                <p style={{ fontSize: 13, color: rec.color, fontWeight: 600, margin: "0 0 4px 0" }}>
                  {rec.icon} {rec.text}
                </p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
            <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
              💬 Recommendations generated by Claude (analysis), Grok (contrarian view), and Llama (validation). Updated daily at 6am.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
