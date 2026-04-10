"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutGrid, Calendar, Brain, FolderOpen, FileText, Mic,
  Users, Building2, Activity, Briefcase, TrendingUp,
  HardDrive, Calculator, Zap, Menu, X, MoreHorizontal, Clock, Server,
} from "lucide-react";

const nav = [
  { href: "/claims",    label: "Claims",          icon: Briefcase,     primary: true },
  { href: "/cases",     label: "Case Registry",   icon: FolderOpen,    primary: true },
  { href: "/workbench",          label: "Valuation Bench",  icon: Calculator,    primary: true },
  { href: "/workbench/negotiate", label: "Negotiate",         icon: Zap,           primary: true },
  { href: "/te",                 label: "Time & Expenses",   icon: Clock,         primary: true },
  { href: "/seo",       label: "SEO & Marketing",  icon: TrendingUp },
  { href: "/marketing", label: "Ad Analytics",     icon: TrendingUp },
  { href: "/tasks",     label: "Task Board",      icon: LayoutGrid },
  { href: "/calendar",  label: "Calendar",        icon: Calendar },
  { href: "/memory",     label: "Memory",          icon: Brain },
  { href: "/recordings", label: "Notes",     icon: Mic   },
  { href: "/files",     label: "Files",           icon: HardDrive },
  { href: "/operations", label: "Operations",       icon: Activity },
  { href: "/consensus",   label: "Consensus Engine", icon: Brain },
  { href: "/system",    label: "System Health",   icon: Server },
  { href: "/projects",  label: "Projects",        icon: FolderOpen },
  { href: "/documents", label: "Documents",       icon: FileText },
  { href: "/team",      label: "Team",            icon: Users },
  { href: "/office",    label: "Office",          icon: Building2 },
  { href: "/activity",  label: "Activity Feed",   icon: Activity },
];

// Bottom tab bar: 4 primary + More
const bottomTabs = [
  { href: "/claims",    label: "Claims",    icon: Briefcase },
  { href: "/workbench",           label: "Bench",    icon: Calculator },
  { href: "/seo",                 label: "SEO",       icon: TrendingUp },
  { href: "/cases",               label: "Cases",     icon: FolderOpen },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* ── Desktop Sidebar ───────────────────────────────────────────── */}
      <aside className="mc-sidebar" style={{
        width: 220,
        height: "100vh",
        background: "#0F172A",
        borderRight: "1px solid #1E293B",
        flexDirection: "column",
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "18px 16px 16px", borderBottom: "1px solid #1E293B" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 6, overflow: "hidden", background: "#fff" }}>
              <Image src="/logo-mark.jpg" alt="Claims.Coach" width={36} height={36} style={{ objectFit: "contain" }} />
            </div>
            <div>
              <p style={{ margin: 0, lineHeight: 1.1 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#147EFA", letterSpacing: "-0.01em" }}>CLAIMS</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#FF8600", letterSpacing: "-0.01em" }}>.COACH</span>
              </p>
              <p style={{ fontSize: 9, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", margin: "3px 0 0" }}>Mission Control</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
          {nav.map(({ href, label, icon: Icon, primary }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "7px 11px", borderRadius: 7,
                fontSize: 12.5, fontWeight: active ? 700 : 500,
                color: active ? (primary ? "#FFFFFF" : "#E2E8F0") : (primary ? "#94A3B8" : "#64748B"),
                background: active ? (primary ? "#147EFA" : "#1E293B") : "transparent",
                textDecoration: "none", transition: "all 0.12s ease",
                borderLeft: active && primary ? "none" : active ? "2px solid #147EFA" : "2px solid transparent",
              }}>
                <Icon size={14} strokeWidth={active ? 2.2 : 1.8} color={active && primary ? "white" : active ? "#147EFA" : undefined} />
                {label}
                {primary && !active && (
                  <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: "#FF8600", flexShrink: 0 }} />
                )}
              </Link>
            );
          })}
        </nav>

        <div style={{ height: 1, background: "#1E293B", margin: "0 12px" }} />
        <div style={{ padding: "14px", display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #147EFA, #0d5dbf)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0 }}>J</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Johnny Walker</p>
            <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>Claims.Coach</p>
          </div>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", flexShrink: 0, boxShadow: "0 0 6px #22C55E88" }} title="Online" />
        </div>
      </aside>

      {/* ── Mobile Top Header ─────────────────────────────────────────── */}
      <header className="mc-mobile-header" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 52, background: "#0F172A",
        borderBottom: "1px solid #1E293B",
        alignItems: "center", justifyContent: "space-between",
        padding: "0 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 5, overflow: "hidden", background: "#fff", flexShrink: 0 }}>
            <Image src="/logo-mark.jpg" alt="Claims.Coach" width={28} height={28} style={{ objectFit: "contain" }} />
          </div>
          <p style={{ margin: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#147EFA" }}>CLAIMS</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#FF8600" }}>.COACH</span>
          </p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "#94A3B8", display: "flex", alignItems: "center" }}
        >
          <Menu size={22} />
        </button>
      </header>

      {/* ── Mobile Drawer Overlay ─────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="mc-drawer-overlay"
          onClick={() => setDrawerOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200 }}
        />
      )}

      {/* ── Mobile Drawer ─────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 260,
        background: "#0F172A", zIndex: 201,
        transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.22s ease",
        display: "flex", flexDirection: "column",
        borderRight: "1px solid #1E293B",
      }}>
        {/* Drawer header */}
        <div style={{ padding: "16px", borderBottom: "1px solid #1E293B", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, overflow: "hidden", background: "#fff" }}>
              <Image src="/logo-mark.jpg" alt="Claims.Coach" width={32} height={32} style={{ objectFit: "contain" }} />
            </div>
            <div>
              <p style={{ margin: 0, lineHeight: 1.1 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#147EFA" }}>CLAIMS</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#FF8600" }}>.COACH</span>
              </p>
              <p style={{ fontSize: 8, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", margin: "2px 0 0" }}>Mission Control</p>
            </div>
          </div>
          <button onClick={() => setDrawerOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Drawer nav */}
        <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
          {nav.map(({ href, label, icon: Icon, primary }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} onClick={() => setDrawerOpen(false)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8,
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? (primary ? "#FFFFFF" : "#E2E8F0") : (primary ? "#94A3B8" : "#64748B"),
                background: active ? (primary ? "#147EFA" : "#1E293B") : "transparent",
                textDecoration: "none",
              }}>
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8} color={active && primary ? "white" : active ? "#147EFA" : undefined} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div style={{ height: 1, background: "#1E293B", margin: "0 12px" }} />
        <div style={{ padding: "14px", display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #147EFA, #0d5dbf)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white" }}>J</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0", margin: 0 }}>Johnny Walker</p>
            <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>Claims.Coach</p>
          </div>
          <div style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px #22C55E88" }} />
        </div>
      </div>

      {/* ── Mobile Bottom Tab Bar ─────────────────────────────────────── */}
      <nav className="mc-bottom-nav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        height: 60, background: "#0F172A",
        borderTop: "1px solid #1E293B",
        alignItems: "stretch", justifyContent: "stretch",
      }}>
        {bottomTabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 3,
              textDecoration: "none",
              color: active ? "#147EFA" : "#64748B",
              borderTop: active ? "2px solid #147EFA" : "2px solid transparent",
              background: active ? "#111827" : "transparent",
              transition: "all 0.12s",
            }}>
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: "0.02em" }}>{label}</span>
            </Link>
          );
        })}
        {/* More button */}
        <button onClick={() => setDrawerOpen(true)} style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 3,
          background: "none", border: "none", cursor: "pointer",
          color: "#64748B", borderTop: "2px solid transparent",
        }}>
          <MoreHorizontal size={20} strokeWidth={1.8} />
          <span style={{ fontSize: 10, fontWeight: 500 }}>More</span>
        </button>
      </nav>
    </>
  );
}
