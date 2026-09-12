import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Book a Free Consultation — Claims.Coach",
  description: "Book a free 30-minute consultation with a licensed vehicle appraiser. Pick a time, then optionally watch the short preparation video — no obligation.",
  openGraph: {
    title: "Book a Free Consultation — Claims.Coach",
    description: "Choose a time for a free 30-minute consultation with a licensed vehicle appraiser — no obligation.",
    url: "https://claims.coach/book-a-consultation",
    siteName: "Claims.Coach",
    type: "website",
  },
};

/**
 * Standalone layout for booking page - bypasses main app sidebar/chrome
 * This page is customer-facing and needs a clean, focused layout
 */
export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ 
      minHeight: "100vh",
      background: "#F8FAFC",
      /* Ensure no parent overflow constraints */
      overflow: "visible",
    }}>
      {children}
    </div>
  );
}
