import React from "react";
import Topbar from "../components/Topbar";
import ContentArea from "../components/ContentArea";

// PUBLIC_INTERFACE
export default function Templates() {
  /** Placeholder templates view. */
  return (
    <>
      <Topbar title="Templates" subtitle="Template browsing will be added here." />
      <ContentArea>
        <div className="card">
          <div className="cardHeader">
            <h2>Coming soon</h2>
            <span>placeholder</span>
          </div>
          <div className="helpText">
            This section will list available presentation templates and allow previews/selection.
          </div>
        </div>
      </ContentArea>
    </>
  );
}
