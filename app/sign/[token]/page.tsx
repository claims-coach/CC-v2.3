"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";

const NAVY   = "#14193199";
const ORANGE = "#FF8600";
const NAV    = "#141931";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export default function SignPage() {
  const params = useParams();
  const rawToken = Array.isArray(params.token) ? params.token[0] : (params.token as string) || "";
  // Strip "-u" suffix for DB lookup
  const dbToken = rawToken.endsWith("-u") ? rawToken.slice(0, -2) : rawToken;
  const isUmpire = rawToken.endsWith("-u");

  const award = useQuery(api.awardRequests.getByToken, { token: dbToken });
  const recordSignature = useMutation(api.awardRequests.recordSignature);

  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Determine signer role
  const signer = isUmpire ? "umpire" : "insurer";
  const signerLabel = isUmpire ? "Umpire" : "Insurer's Appraiser";
  const signerName = isUmpire ? award?.umpire : award?.insurerAppraiser;

  // Check if already signed
  const alreadySigned = signer === "umpire"
    ? !!award?.umpireSigDate
    : !!award?.insurerSigDate;

  // Canvas drawing
  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    lastPos.current = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !lastPos.current) return;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = NAV;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawing(true);
  };

  const stopDraw = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };

  const handleSign = async () => {
    if (!award?._id) return;
    if (!agreed) { setError("Please check the agreement box."); return; }
    if (!drawMode && !typedName.trim()) { setError("Please type your name to sign."); return; }
    if (drawMode && !hasDrawing) { setError("Please draw your signature."); return; }

    setSigning(true);
    setError("");
    try {
      const date = new Date().toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });
      await recordSignature({ id: award._id, signer, date });
      setDone(true);
    } catch (e) {
      setError(String(e));
    }
    setSigning(false);
  };

  if (award === undefined) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", color: "#94A3B8", padding: 40 }}>Loading award…</div>
        </div>
      </div>
    );
  }

  if (award === null) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", color: "#EF4444", padding: 40 }}>
            Award not found. This link may be invalid or expired.
          </div>
        </div>
      </div>
    );
  }

  if (done || alreadySigned) {
    const name = typedName.trim() || signerName || "You";
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: NAV, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              {alreadySigned && !done ? "Already Signed" : "Signature Recorded"}
            </h2>
            <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.6 }}>
              {alreadySigned && !done
                ? `This document has already been signed.`
                : `Thank you, ${name}. Your signature has been recorded. Johnny Walker will be notified.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Brand header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: NAV, letterSpacing: -0.5 }}>
          Claims.<span style={{ color: ORANGE }}>Coach</span>
        </div>
        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Walker Appraisal · Digital Signature Portal</div>
      </div>

      <div style={cardStyle}>
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            ACV Award — Signature Required
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: NAV, margin: 0 }}>
            {signerLabel}
          </h1>
          {signerName && (
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>{signerName}</div>
          )}
        </div>

        {/* Award details */}
        <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
          <div style={detailRow}>
            <span style={detailLabel}>Claim Number</span>
            <span style={detailVal}>{award.claimNumber || "—"}</span>
          </div>
          <div style={detailRow}>
            <span style={detailLabel}>Policyholder</span>
            <span style={detailVal}>{award.ownerName || "—"}</span>
          </div>
          <div style={detailRow}>
            <span style={detailLabel}>Vehicle</span>
            <span style={detailVal}>{award.vehicle || "—"}</span>
          </div>
          <div style={detailRow}>
            <span style={detailLabel}>VIN</span>
            <span style={{ ...detailVal, fontFamily: "monospace", fontSize: 12 }}>{award.vin || "—"}</span>
          </div>
          <div style={detailRow}>
            <span style={detailLabel}>Insurance Company</span>
            <span style={detailVal}>{award.carrier || "—"}</span>
          </div>
          <div style={{ ...detailRow, borderBottom: "none", marginBottom: 0 }}>
            <span style={detailLabel}>Actual Cash Value</span>
            <span style={{ ...detailVal, color: ORANGE, fontWeight: 700, fontSize: 18 }}>{fmt(award.acvAward)}</span>
          </div>
        </div>

        {/* Parties */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={partyCard}>
            <div style={partyLabel}>Insured's Appraiser</div>
            <div style={partyName}>{award.insuredAppraiser || "Johnny Walker"}</div>
          </div>
          {award.insurerAppraiser && (
            <div style={partyCard}>
              <div style={partyLabel}>Insurer's Appraiser</div>
              <div style={partyName}>{award.insurerAppraiser}</div>
            </div>
          )}
          {award.umpire && (
            <div style={partyCard}>
              <div style={partyLabel}>Umpire</div>
              <div style={partyName}>{award.umpire}</div>
            </div>
          )}
        </div>

        {/* Legal text */}
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 20, padding: "12px 14px", background: "#FFFBF0", borderLeft: `3px solid ${ORANGE}`, borderRadius: "0 8px 8px 0" }}>
          By signing below, I confirm that I have reviewed this Actual Cash Value Award and agree to the stated value of <strong>{fmt(award.acvAward)}</strong> for the vehicle described above.
        </div>

        {/* Signature input */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: NAV }}>Your Signature</label>
            <button
              onClick={() => setDrawMode(!drawMode)}
              style={{ fontSize: 11, color: ORANGE, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              {drawMode ? "Type instead" : "Draw instead"}
            </button>
          </div>

          {!drawMode ? (
            <input
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder="Type your full legal name"
              style={{
                width: "100%", padding: "12px 14px", border: "1.5px solid #E2E8F0",
                borderRadius: 8, fontSize: 18, fontFamily: "'Georgia', serif",
                color: NAV, outline: "none", boxSizing: "border-box",
              }}
            />
          ) : (
            <div>
              <canvas
                ref={canvasRef}
                width={460}
                height={100}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
                style={{
                  width: "100%", height: 100, border: "1.5px solid #E2E8F0",
                  borderRadius: 8, background: "#fff", cursor: "crosshair", touchAction: "none",
                }}
              />
              {hasDrawing && (
                <button onClick={clearCanvas} style={{ fontSize: 11, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", marginTop: 4 }}>
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Agreement checkbox */}
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: 2, accentColor: ORANGE, width: 16, height: 16, flexShrink: 0 }}
          />
          <span style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
            I agree to sign this document electronically. I understand this constitutes a legally binding signature equivalent to my handwritten signature.
          </span>
        </label>

        {/* Error */}
        {error && (
          <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "#FEF2F2", borderRadius: 6 }}>
            {error}
          </div>
        )}

        {/* Sign button */}
        <button
          onClick={handleSign}
          disabled={signing || !agreed || (!drawMode && !typedName.trim()) || (drawMode && !hasDrawing)}
          style={{
            width: "100%", padding: "14px", borderRadius: 10, border: "none",
            background: ORANGE, color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: signing ? "not-allowed" : "pointer", opacity: signing ? 0.7 : 1,
          }}
        >
          {signing ? "Signing…" : "Sign Document"}
        </button>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#94A3B8" }}>
          Claims.Coach · Walker Appraisal · Everett, WA · WAC 284-30-391 Compliant
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#F1F5F9",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 16,
  padding: "28px 24px",
  width: "100%",
  maxWidth: 520,
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
};

const detailRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "7px 0",
  borderBottom: "1px solid #F1F5F9",
  gap: 12,
};

const detailLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#94A3B8",
  flexShrink: 0,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const detailVal: React.CSSProperties = {
  fontSize: 13,
  color: "#334155",
  fontWeight: 500,
  textAlign: "right",
};

const partyCard: React.CSSProperties = {
  flex: 1,
  background: "#F8FAFC",
  borderRadius: 8,
  padding: "8px 10px",
  border: "1px solid #E2E8F0",
};

const partyLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: "#94A3B8",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 2,
};

const partyName: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#334155",
};
