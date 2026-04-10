"use client";
import Link from "next/link";
import { Scale, TrendingDown, Clock, ArrowRight } from "lucide-react";

const tools = [
  {
    href: "/workbench/acv",
    icon: Scale,
    label: "ACV / Appraisal Clause",
    sub: "First-Party Carrier",
    desc: "Dispute the insurer's total loss valuation through the appraisal clause. Comp-based methodology, mileage adjustments, add-ons, and full results package.",
    color: "#147EFA",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    tags: ["6 Tabs", "Comps", "Demand Letter", "Client Comms"],
  },
  {
    href: "/workbench/dv",
    icon: TrendingDown,
    label: "Diminished Value",
    sub: "At-Fault / UM / UIM",
    desc: "Recover the lost market value after a repair. Market-based methodology only — no 17c formula. For at-fault carrier claims or uninsured/underinsured motorist.",
    color: "#FF8600",
    bg: "#FFF7ED",
    border: "#FED7AA",
    tags: ["3 Tabs", "DV Calculation", "DV Report", "Demand Letter"],
  },
  {
    href: "/workbench/lou",
    icon: Clock,
    label: "Loss of Use",
    sub: "At-Fault / UM / UIM",
    desc: "Calculate compensation for time without a vehicle. Rental rate, days out of service, and additional transportation costs.",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    tags: ["Single Page", "Day Calculator", "Demand Letter"],
  },
];

export default function WorkbenchSelector() {
  return (
    <div style={{ padding: "40px 48px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>
          Valuation Workbench
        </h1>
        <p style={{ fontSize: 14, color: "#64748B", margin: 0, fontWeight: 500 }}>
          Select the claim type to open the appropriate tool.
        </p>
      </div>

      {/* Tool Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {tools.map(({ href, icon: Icon, label, sub, desc, color, bg, border, tags }) => (
          <Link key={href} href={href} style={{ textDecoration: "none" }}>
            <div style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 16,
              padding: "28px 32px",
              display: "flex",
              alignItems: "flex-start",
              gap: 24,
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = color;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${color}22`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
              }}
            >
              {/* Icon */}
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: bg,
                border: `1px solid ${border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={24} color={color} strokeWidth={2} />
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>{label}</h2>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                    background: bg, color, border: `1px solid ${border}`,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>{sub}</span>
                </div>
                <p style={{ fontSize: 13.5, color: "#64748B", margin: "0 0 12px", lineHeight: 1.6, fontWeight: 500 }}>{desc}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {tags.map(t => (
                    <span key={t} style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                      background: "#F1F5F9", color: "#64748B",
                    }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Arrow */}
              <div style={{ flexShrink: 0, marginTop: 4 }}>
                <ArrowRight size={20} color="#CBD5E1" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Note */}
      <div style={{ marginTop: 32, padding: "14px 20px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10 }}>
        <p style={{ fontSize: 12, color: "#94A3B8", margin: 0, fontWeight: 500 }}>
          <span style={{ color: "#147EFA", fontWeight: 700 }}>Remember: </span>
          ACV / Appraisal Clause is always against the first-party carrier.
          Diminished Value and Loss of Use are 99% of the time against the at-fault carrier or under UM/UIM.
        </p>
      </div>
    </div>
  );
}
