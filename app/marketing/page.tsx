"use client";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList } from "recharts";

const colors = {
  facebook: "#1877F2",
  google: "#EA4335",
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#ef4444",
};

export default function MarketingPage() {
  const [dateRange, setDateRange] = useState<{ start: number; end: number }>({
    start: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
    end: Date.now(),
  });

  // Fetch data
  const spendData = useQuery(api.marketingAds.getAdSpendByDateRange, {
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const leadData = useQuery(api.marketingAds.getMarketingLeadsByDateRange, {
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const campaigns = useQuery(api.marketingAds.getCampaignPerformance, {
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const platforms = useQuery(api.marketingAds.getPlatformComparison, {
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const quality = useQuery(api.marketingAds.getLeadQualityBreakdown, {
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Calculate metrics
  const totalSpend = spendData?.reduce((sum: number, s: any) => sum + s.spend, 0) || 0;
  const totalLeads = leadData?.length || 0;
  const cpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : "N/A";
  const avgCtr = spendData?.length > 0 ? (spendData.reduce((sum: number, s: any) => sum + parseFloat(s.ctr || 0), 0) / spendData.length).toFixed(2) : "0";

  // Prepare chart data
  const spendTrend = spendData
    ?.reduce((acc: any[], spend: any) => {
      const date = new Date(spend.date).toLocaleDateString();
      const existing = acc.find((d) => d.date === date);
      if (existing) {
        existing.spend += spend.spend;
      } else {
        acc.push({ date, spend: spend.spend, clicks: spend.clicks });
      }
      return acc;
    }, [])
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];

  const platformData = platforms || [];

  const qualityData = quality
    ? [
        { name: "High Quality", value: quality.High || 0 },
        { name: "Medium Quality", value: quality.Medium || 0 },
        { name: "Low Quality", value: quality.Low || 0 },
      ]
    : [];

  const funnelData = quality
    ? [
        { name: "Total Leads", value: quality.total || 0 },
        { name: "High Quality", value: quality.High || 0 },
        { name: "Converted", value: quality.converted || 0 },
      ]
    : [];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0 }}>
          📊 Marketing Performance
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
          Google Ads & Facebook Ads • 30 Days • Real-time tracking
        </p>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        {/* Top Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Total Spend", val: `$${totalSpend.toLocaleString("en-US", { maximumFractionDigits: 2 })}`, color: "#3b82f6" },
            { label: "Leads Generated", val: totalLeads.toString(), color: "#22c55e" },
            { label: "Cost Per Lead", val: typeof cpl === "number" ? `$${cpl}` : cpl, color: "#f59e0b" },
            { label: "Avg CTR", val: `${avgCtr}%`, color: "#a78bfa" },
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
              <p style={{ fontSize: 32, fontWeight: 800, color: m.color, margin: "0 0 8px 0" }}>
                {m.val}
              </p>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", margin: 0 }}>
                {m.label}
              </p>
            </div>
          ))}
        </div>

        {/* Spend Trend */}
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
            Spend Trend (Last 30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={spendTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" style={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Legend />
              <Line type="monotone" dataKey="spend" stroke={colors.google} name="Daily Spend ($)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Platform Comparison */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
          {/* Platform Spend */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px",
            }}
          >
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
              Spend by Platform
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={platformData.map((p: any) => ({ name: p.platform, value: parseFloat(p.spend) }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: $${value.toLocaleString()}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {platformData.map((p: any, idx: number) => (
                    <Cell key={`cell-${idx}`} fill={p.platform === "Facebook" ? colors.facebook : colors.google} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Platform CPL */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px",
            }}
          >
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
              Cost Per Lead by Platform
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={platformData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="platform" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip formatter={(value: any) => `$${value}`} />
                <Bar dataKey="cpl" fill="#f59e0b" name="CPL ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Campaign Table */}
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
            Campaign Performance
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ textAlign: "left", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Campaign</th>
                <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Spend</th>
                <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>Leads</th>
                <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>CPL</th>
                <th style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "#0f172a", fontSize: 12 }}>CTR</th>
              </tr>
            </thead>
            <tbody>
              {campaigns?.slice(0, 10).map((c: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px", color: "#0f172a", fontSize: 12 }}>{c.campaignName}</td>
                  <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>
                    ${c.totalSpend?.toLocaleString() || "0"}
                  </td>
                  <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>
                    {c.totalLeads || 0}
                  </td>
                  <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>
                    ${(c.cpl || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: "12px", color: "#0f172a", fontSize: 12, textAlign: "right" }}>
                    {(c.ctr || 0).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Lead Quality */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Quality Pie */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px",
            }}
          >
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
              Lead Quality Breakdown
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={qualityData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {qualityData.map((d: any, idx: number) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={d.name.includes("High") ? colors.high : d.name.includes("Medium") ? colors.medium : colors.low}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Conversion Funnel */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px",
            }}
          >
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
              Conversion Funnel
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <FunnelChart data={funnelData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Funnel dataKey="value" data={funnelData} fill="#3b82f6">
                  <LabelList dataKey="value" position="insideInlineStart" fill="#fff" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
