export default function MissionBanner() {
  return (
    <div className="mc-banner" style={{
      background: "#FFFFFF",
      borderBottom: "1px solid #E2E8F0",
      padding: "9px 28px",
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}>
      <div style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "#147EFA",
        flexShrink: 0,
        boxShadow: "0 0 6px #147EFA88",
      }} />
      <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, fontWeight: 500 }}>
        <span style={{ color: "#FF8600", fontWeight: 700 }}>Mission: </span>
        <span style={{ color: "#64748B" }}>
          Build the most automated claims operation in America — faster, fairer, and more profitable through AI.
        </span>
      </p>
    </div>
  );
}
