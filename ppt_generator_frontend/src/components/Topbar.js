import React from "react";

// PUBLIC_INTERFACE
export default function Topbar({ title, subtitle, right }) {
  /** Minimal top bar for the main content area. */
  return (
    <div className="topbar">
      <div className="topbarTitle">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}
