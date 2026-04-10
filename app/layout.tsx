import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import Sidebar from "@/components/Sidebar";
import MissionBanner from "@/components/MissionBanner";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Mission Control — Claims.Coach",
  description: "Claims.Coach + Walker Appraisal Command Center",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0F172A" />
      </head>
      <body style={{
        background: "#F1F5F9",
        color: "#334155",
        fontFamily: "var(--font-montserrat), 'Montserrat', system-ui, sans-serif",
        margin: 0,
        height: "100vh",
        overflow: "hidden",
      }}>
        <ConvexClientProvider>
          {/* Desktop layout: sidebar + content side by side */}
          <div style={{ display: "flex", height: "100vh" }}>
            <Sidebar />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
              <MissionBanner />
              {/* mc-main-content gets padding-bottom on mobile to clear bottom nav */}
              {/* mc-mobile-pt adds padding-top on mobile to clear fixed header */}
              <main
                className="mc-main-content mc-mobile-pt"
                style={{ flex: 1, overflowY: "auto", background: "#F1F5F9" }}
              >
                {children}
              </main>
            </div>
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
