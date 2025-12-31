import React from "react";

// PUBLIC_INTERFACE
export default function ProgressBar({ value }) {
  /** Visual + accessible progress indicator. */
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div className="progressBar" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className="progressFill" style={{ width: `${clamped}%` }} />
    </div>
  );
}
