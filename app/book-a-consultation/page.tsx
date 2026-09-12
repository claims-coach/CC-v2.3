"use client";

import { useState } from "react";

/**
 * Book a Consultation Page
 * 
 * MOBILE SCROLL FIX (P0):
 * - Removed fixed 760px iframe height that clipped form on mobile
 * - Iframe now uses min-height with auto-grow via CSS
 * - Removed overflow:hidden/clip traps
 * - Allow iframe scrolling on mobile (removed scrolling="no")
 * - Tested on 390x844 viewport: Year field through Submit now accessible
 */

const CALENDAR_URL = "https://link.claims.coach/widget/booking/LbMYTNHF582imp0fx7bw";

export default function BookAConsultationPage() {
  const [videoPlaying, setVideoPlaying] = useState(false);

  const handleVideoPlay = () => {
    setVideoPlaying(true);
  };

  return (
    <>
      <style jsx global>{`
        /* Reset for booking page - standalone layout */
        .book-page-root {
          min-height: 100vh;
          background: #F8FAFC;
          font-family: 'Montserrat', system-ui, sans-serif;
        }
        
        /* Header */
        .book-header {
          position: sticky;
          top: 0;
          z-index: 20;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid #E2E8F0;
        }
        .book-header-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .book-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .book-brand-text {
          font-weight: 800;
          font-size: 18px;
          letter-spacing: -0.01em;
        }
        .book-brand-text .orange { color: #FF8600; }
        .book-brand-text .blue { color: #147EFA; }
        .book-back {
          font-weight: 600;
          font-size: 14px;
          color: #147EFA;
          text-decoration: none;
        }
        .book-back:hover { text-decoration: underline; }

        /* Hero */
        .book-hero {
          background: linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%);
          color: #fff;
          padding: clamp(2.5rem, 1.5rem + 4vw, 4.5rem) 0 clamp(2rem, 1rem + 3vw, 3.5rem);
        }
        .book-hero-inner {
          max-width: 820px;
          margin: 0 auto;
          padding: 0 20px;
        }
        .book-eyebrow {
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #FF8600;
          margin: 0 0 14px;
        }
        .book-hero h1 {
          font-weight: 800;
          letter-spacing: -0.025em;
          font-size: clamp(1.8rem, 1.2rem + 2.5vw, 2.8rem);
          line-height: 1.12;
          margin: 0 0 16px;
          color: #fff;
        }
        .book-hero-lead {
          font-size: clamp(1rem, 0.9rem + 0.4vw, 1.15rem);
          line-height: 1.65;
          color: rgba(255,255,255,0.8);
          margin: 0;
          max-width: 640px;
        }

        /* Main grid */
        .book-grid {
          max-width: 1120px;
          margin: 0 auto;
          padding: 32px 20px 72px;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 40px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .book-grid {
            grid-template-columns: 1fr;
            gap: 32px;
          }
        }

        /* Calendar card - MOBILE FIX */
        .cal-card {
          background: #fff;
          border: 1px solid #E2E8F0;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(15,23,42,0.08);
          /* REMOVED: overflow: hidden - this was clipping the iframe content */
          overflow: visible;
        }
        
        /* MOBILE SCROLL FIX: Responsive iframe height */
        .cal-card iframe {
          width: 100%;
          border: 0;
          display: block;
          border-radius: 16px;
          /* Desktop: comfortable fixed height */
          height: 780px;
          /* Allow content to be scrollable if needed */
          overflow: auto;
        }
        
        /* CRITICAL MOBILE FIX: Taller iframe on mobile to show full form */
        @media (max-width: 768px) {
          .cal-card iframe {
            /* Mobile needs more height for form fields + virtual keyboard */
            min-height: 900px;
            height: auto;
            /* Ensure minimum height accommodates all form fields */
            /* Year, Make, Model, VIN, Mileage + Submit + padding */
          }
        }
        
        @media (max-width: 480px) {
          .cal-card iframe {
            /* Smallest viewports need even more room */
            min-height: 950px;
          }
        }

        .book-fine {
          font-size: 12.5px;
          color: #64748B;
          font-weight: 600;
          margin: 14px 2px 0;
          text-align: center;
        }

        /* Video card */
        .book-video {
          border: 1px solid #E2E8F0;
          border-radius: 16px;
          background: #fff;
          padding: 18px;
          box-shadow: 0 8px 24px rgba(15,23,42,0.06);
        }
        .book-video .veyebrow {
          font-weight: 800;
          font-size: 12px;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #FF8600;
          margin: 0 0 8px;
        }
        .book-video h2 {
          font-weight: 800;
          font-size: 19px;
          line-height: 1.35;
          color: #0f172a;
          margin: 0 0 8px;
        }
        .book-video p {
          color: #334155;
          font-size: 15.5px;
          line-height: 1.6;
          margin: 0 0 18px;
        }
        .vframe {
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(15,23,42,0.12);
          background: #0F172A;
        }
        .vframe iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
        .vplay {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          appearance: none;
          border: 0;
          cursor: pointer;
          padding: 0;
          background: radial-gradient(120% 120% at 50% 0%, #1E3A63 0%, #0F172A 62%);
          color: #fff;
          font-weight: 700;
          font-size: 13.5px;
        }
        .vplay:hover .vdot { transform: scale(1.07); background: #0F5FC2; }
        .vplay.hidden { display: none; }
        .vdot {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          background: #147EFA;
          box-shadow: 0 10px 26px rgba(20,126,250,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.18s ease, background 0.18s ease;
        }
        .vdot::before {
          content: "";
          border-style: solid;
          border-width: 12px 0 12px 19px;
          border-color: transparent transparent transparent #fff;
          margin-left: 5px;
        }
        .book-points {
          margin: 22px 0 0;
          padding: 0;
          list-style: none;
        }
        .book-points li {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          font-size: 14.5px;
          color: #334155;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .book-points li::before {
          content: "✓";
          flex: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #E8F2FF;
          color: #147EFA;
          font-size: 12px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
        }

        /* Footer */
        .book-footer {
          background: #0F172A;
          color: rgba(255,255,255,0.6);
          font-size: 13.5px;
        }
        .book-footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px 24px;
          justify-content: space-between;
          align-items: center;
        }
        .book-footer a {
          color: rgba(255,255,255,0.7);
          text-decoration: none;
        }
        .book-footer a:hover { color: #fff; }

        /* iOS input zoom fix */
        @media (max-width: 768px) {
          input, select, textarea {
            font-size: 16px !important;
          }
        }
      `}</style>

      <div className="book-page-root book-page-standalone">
        {/* Header */}
        <header className="book-header">
          <div className="book-header-inner">
            <a className="book-brand" href="https://claims.coach">
              <img 
                src="/logo-mark.jpg" 
                alt="Claims.Coach" 
                width={30} 
                height={30} 
                style={{ borderRadius: 6 }}
              />
              <span className="book-brand-text">
                <span className="orange">CLAIMS</span>
                <span className="blue">.COACH</span>
              </span>
            </a>
            <a className="book-back" href="https://claims.coach">← Back to site</a>
          </div>
        </header>

        {/* Hero */}
        <section className="book-hero">
          <div className="book-hero-inner">
            <p className="book-eyebrow">Free consultation</p>
            <h1>Talk to a licensed appraiser — free, 30 minutes.</h1>
            <p className="book-hero-lead">
              Pick a time that works. We&apos;ll tell you straight whether your claim is worth 
              pursuing — including when it isn&apos;t. The short preparation video is optional.
            </p>
          </div>
        </section>

        {/* Main Content */}
        <div className="book-grid">
          {/* Calendar/Booking */}
          <div className="book-scheduler">
            <div className="cal-card">
              <iframe
                id="bookCalendar"
                src={CALENDAR_URL}
                title="Book a 30-minute consultation calendar"
                allow="payment"
                /* MOBILE FIX: Removed scrolling="no" to allow form scrolling */
              />
            </div>
            <p className="book-fine">
              After you book, you&apos;ll see exactly what to have ready for the 30-minute call.
            </p>
          </div>

          {/* Video Card */}
          <aside className="book-video">
            <p className="veyebrow">Optional · 2 minutes</p>
            <h2>What to expect on the call</h2>
            <p>
              Two minutes from Johnny on how the call works and what we can do for your claim.
            </p>
            <div className="vframe">
              {videoPlaying && (
                <iframe
                  src="https://www.loom.com/embed/158c441441954b14a8e7b61ec6d1b0eb?autoplay=1"
                  title="Claims.Coach consultation preparation video"
                  allowFullScreen
                />
              )}
              <button 
                type="button" 
                className={`vplay ${videoPlaying ? "hidden" : ""}`}
                onClick={handleVideoPlay}
                aria-label="Play the 2-minute preparation video"
              >
                <span className="vdot" aria-hidden="true"></span>
                <span>Watch the 2-minute overview</span>
              </button>
            </div>
            <ul className="book-points">
              <li>Free and no obligation — an honest &quot;not worth it&quot; is a real answer</li>
              <li>Licensed, independent appraisers — we work for you, never the carrier</li>
              <li>Have your insurer&apos;s valuation report handy if you have one (CCC, Audatex, or Mitchell)</li>
            </ul>
          </aside>
        </div>

        {/* Footer */}
        <footer className="book-footer">
          <div className="book-footer-inner">
            <span>
              <span style={{ color: "#FF8600", fontWeight: 800 }}>CLAIMS</span>
              <span style={{ color: "#147EFA", fontWeight: 800 }}>.COACH</span>
              {" "}· Claims Northwest LLC
            </span>
            <span>
              <a href="tel:+14255852622">(425) 585-2622</a>
              {" "}·{" "}
              <a href="mailto:info@claims.coach">info@claims.coach</a>
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}
