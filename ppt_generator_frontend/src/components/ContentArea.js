import React from "react";

// PUBLIC_INTERFACE
export default function ContentArea({ children }) {
  /** Wrapper for the main workspace content. */
  return <div className="workspace">{children}</div>;
}
