"use client";
import ClearCacheButton from "./ClearCacheButton";

export default function VersionRibbon() {
  const v = process.env.NEXT_PUBLIC_BUILD_TS || "dev";
  return (
    <div style={{
      fontSize: 12,
      display: "flex",
      gap: 12,
      alignItems: "center",
      padding: "6px 10px",
      borderBottom: "1px solid #eee",
      background: "#fafafa",
      position: "sticky",
      top: 0,
      zIndex: 50
    }}>
      <span><strong>Build:</strong> {String(v)}</span>
      <ClearCacheButton small />
    </div>
  );
}


