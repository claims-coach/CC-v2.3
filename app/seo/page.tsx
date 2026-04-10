"use client";
import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

const colors = {
  facebook: "#1877F2",
  google: "#EA4335",
  organic: "#34A853",
  paid: "#FBBC04",
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#ef4444",
};

// Mock data for demo (will be replaced with real API data)
const mockTrafficData = [
  { date: "Mar 1", organic: 245, paid: 120, social: 89, direct: 56 },
  { date: "Mar 5", organic: 321, paid: 135, social: 102, direct: 64 },
  { date: "Mar 10", organic: 398, paid: 156, social: 134, direct: 78 },
  { date: "Mar 15", organic: 487, paid: 198, social: 167, direct: 92 },
  { date: "Mar 20", organic: 564, paid: 234, social: 201, direct: 108 },
  { date: "Mar 25", organic: 623, paid: 267, social: 243, direct: 127 },
  { date: "Mar 30", organic: 712, paid: 304, social: 287, direct: 149 },
];

const mockKeywordData = [
  { keyword: "ACV appraisal dispute", rank: 3, volume: 320, ctr: 8.2, clicks: 26 },
  { keyword: "diminished value claim", rank: 5, volume: 480, ctr: 6.1, clicks: 29 },
  { keyword: "loss of use insurance", rank: 2, volume: 210, ctr: 12.3, clicks: 26 },
  { keyword: "insurance claim appeal", rank: 7, volume: 890, ctr: 3.4, clicks: 30 },
  { keyword: "claim appraiser near me", rank: 4, volume: 156, ctr: 9.1, clicks: 14 },
  { keyword: "public adjuster services", rank: 6, volume: 340, ctr: 5.8, clicks: 20 },
];

const mockCampaignData = [
  { name: "ACV Disputes - Google", spend: 1200, leads: 24, cpl: 50, roas: 3.2 },
  { name: "DV Claims - Facebook", spend: 800, leads: 18, cpl: 44, roas: 2.8 },
  { name: "Loss of Use - Google", spend: 600, leads: 12, cpl: 50, roas: 2.5 },
  { name: "Organic Content", spend: 0, leads: 34, cpl: 0, roas: 5.2 },
];

const mockContentPerformance = [
  { title: "How to File ACV Dispute", views: 3400, shares: 127, conversions: 24 },
  { title: "DV Settlement Guide", views: 2800, shares: 89, conversions: 18 },
  { title: "Insurance Appeal Process", views: 2100, shares: 64, conversions: 14 },
  { title: "Loss of Use Valuation", views: 1900, shares: 52, conversions: 12 },
];

export default function SEOPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30d");

  // Calculate metrics
  const totalTraffic = mockTrafficData[mockTrafficData.length - 1].organic + 
                       mockTrafficData[mockTrafficData.length - 1].paid +
                       mockTrafficData[mockTrafficData.length - 1].social;
  const avgRank = (mockKeywordData.reduce((sum, k) => sum + k.rank, 0) / mockKeywordData.length).toFixed(1);
  const totalLeads = mockCampaignData.reduce((sum, c) => sum + c.leads, 0);
  const totalSpend = mockCampaignData.reduce((sum, c) => sum + c.spend, 0);
  const avgCPL = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : "N/A";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0 }}>
          🎯 SEO & Marketing Command Center
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
          Master dashboard • Organic + Paid • Real-time tracking
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e2e8f0", background: "#ffffff", padding: "0 32px" }}>
        {["overview", "seo", "ppc", "content", "analytics"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "12px 20px",
              fontSize: 12,
              fontWeight: 700,
              color: activeTab === tab ? "#0f172a" : "#64748b",
              borderBottom: activeTab === tab ? "3px solid #3b82f6" : "none",
              background: "transparent",
              cursor: "pointer",
              textTransform: "uppercase",
              border: "none",
              transition: "all 0.2s",
            }}
          >
            {tab === "overview" && "📊 Overview"}
            {tab === "seo" && "🔍 SEO"}
            {tab === "ppc" && "💰 PPC"}
            {tab === "content" && "📝 Content"}
            {tab === "analytics" && "📈 Analytics"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <>
            {/* Top Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Total Traffic", val: totalTraffic.toLocaleString(), color: "#3b82f6", icon: "📊" },
                { label: "Avg Keyword Rank", val: `#${avgRank}`, color: "#22c55e", icon: "🔍" },
                { label: "Total Leads", val: totalLeads.toString(), color: "#f59e0b", icon: "👥" },
                { label: "Avg CPL", val: `$${avgCPL}`, color: "#a78bfa", icon: "💰" },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "20px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <p style={{ fontSize: 28, fontWeight: 800, color: m.color, margin: "0 0 8px 0" }}>
                    {m.icon} {m.val}
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", margin: 0 }}>
                    {m.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Traffic Trend */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "20px",
                marginBottom: 32,
              }}
            >
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
                Traffic Trend (30 Days)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mockTrafficData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 12 }} />
                  <YAxis stroke="#64748b" style={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Legend />
                  <Area type="monotone" dataKey="organic" stackId="1" stroke={colors.organic} fill={colors.organic} name="Organic" />
                  <Area type="monotone" dataKey="paid" stackId="1" stroke={colors.paid} fill={colors.paid} name="Paid" />
                  <Area type="monotone" dataKey="social" stackId="1" stroke={colors.facebook} fill={colors.facebook} name="Social" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Campaigns vs Organic */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "20px",
                }}
              >
                <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
                  Campaign Performance
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={mockCampaignData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: 10 }} angle={-15} textAnchor="end" height={70} />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="leads" fill="#3b82f6" name="Leads" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "20px",
                }}
              >
                <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
                  Traffic Source Mix
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Organic", value: mockTrafficData[mockTrafficData.length - 1].organic },
                        { name: "Paid", value: mockTrafficData[mockTrafficData.length - 1].paid },
                        { name: "Social", value: mockTrafficData[mockTrafficData.length - 1].social },
                        { name: "Direct", value: mockTrafficData[mockTrafficData.length - 1].direct },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[colors.organic, colors.paid, colors.facebook, "#8b5cf6"].map((c, i) => (
                        <Cell key={`cell-${i}`} fill={c} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* SEO TAB */}
        {activeTab === "seo" && (
          <>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "20px",
                marginBottom: 32,
                overflowX: "auto",
              }}
            >
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
                Top Keywords
              </h2>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Keyword</th>
                    <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Rank</th>
                    <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Volume</th>
                    <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>CTR</th>
                    <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {mockKeywordData.map((k, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, fontWeight: 600 }}>{k.keyword}</td>
                      <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>
                        <span style={{
                          background: k.rank <= 3 ? "#dcfce7" : k.rank <= 5 ? "#fef3c7" : "#fee2e2",
                          color: k.rank <= 3 ? "#166534" : k.rank <= 5 ? "#92400e" : "#991b1b",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          #{k.rank}
                        </span>
                      </td>
                      <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>{k.volume}</td>
                      <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>{k.ctr}%</td>
                      <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>{k.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* PPC TAB */}
        {activeTab === "ppc" && (
          <>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "20px",
                marginBottom: 32,
              }}
            >
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
                📺 Campaign Performance
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ textAlign: "left", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Campaign</th>
                      <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Spend</th>
                      <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Leads</th>
                      <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>CPL</th>
                      <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockCampaignData.map((c, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, fontWeight: 600 }}>{c.name}</td>
                        <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>${c.spend.toLocaleString()}</td>
                        <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>{c.leads}</td>
                        <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>${c.cpl.toFixed(2)}</td>
                        <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>
                          <span style={{ color: c.roas > 3 ? "#16a34a" : "#ea580c", fontWeight: 700 }}>{c.roas}x</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* CONTENT TAB */}
        {activeTab === "content" && (
          <>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "20px",
                marginBottom: 32,
              }}
            >
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
                Content Performance
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ textAlign: "left", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Content</th>
                      <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Views</th>
                      <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Shares</th>
                      <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Conversions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockContentPerformance.map((c, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, fontWeight: 600 }}>{c.title}</td>
                        <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>{c.views.toLocaleString()}</td>
                        <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>{c.shares}</td>
                        <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>{c.conversions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "20px",
              }}
            >
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
                Real-Time Data Sources
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                {[
                  { name: "Google Ads", status: "⏳ Initializing (24h wait)", color: "#ea4335" },
                  { name: "Facebook Ads", status: "✅ Connected", color: "#1877f2" },
                  { name: "Google Analytics 4", status: "🔧 Ready to connect", color: "#34a853" },
                  { name: "SEO Tools (Ahrefs/Semrush)", status: "🔧 Ready to connect", color: "#f59e0b" },
                ].map((source) => (
                  <div
                    key={source.name}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "16px",
                    }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 4px 0" }}>{source.name}</p>
                    <p style={{ fontSize: 11, color: source.color, margin: 0, fontWeight: 600 }}>{source.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
