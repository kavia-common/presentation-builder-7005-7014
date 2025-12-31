import React, { useMemo } from "react";
import Topbar from "../components/Topbar";
import ContentArea from "../components/ContentArea";
import { getApiBaseUrl, getWsUrl, isMockMode } from "../utils/env";

// PUBLIC_INTERFACE
export default function Settings() {
  /** Basic settings page: shows configured env URLs and mock mode state. */
  const info = useMemo(() => {
    const api = getApiBaseUrl();
    const ws = getWsUrl();
    return {
      api: api || "(not set)",
      ws: ws || "(not set)",
      mock: isMockMode() ? "enabled" : "disabled",
    };
  }, []);

  return (
    <>
      <Topbar title="Settings" subtitle="Configuration and environment information." />
      <ContentArea>
        <div className="grid2">
          <div className="card">
            <div className="cardHeader">
              <h2>Environment</h2>
              <span>read-only</span>
            </div>

            <div className="formRow">
              <label>API Base URL</label>
              <div className="helpText">{info.api}</div>
            </div>

            <div className="formRow">
              <label>WebSocket URL (future)</label>
              <div className="helpText">{info.ws}</div>
            </div>

            <div className="formRow">
              <label>Mock mode</label>
              <div className="helpText">
                <strong>{info.mock}</strong> — mock mode is used when <span className="kbd">REACT_APP_API_BASE</span>{" "}
                and <span className="kbd">REACT_APP_BACKEND_URL</span> are not set.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <h2>Notes</h2>
              <span>help</span>
            </div>
            <div className="helpText" style={{ lineHeight: 1.6 }}>
              The frontend is designed to work even without a backend. In mock mode, generation simulates progress and
              produces a placeholder <span className="kbd">.pptx</span> download.
              <br />
              <br />
              If your backend supports it, configure <span className="kbd">REACT_APP_API_BASE</span> to point to the API
              (e.g. <span className="kbd">http://localhost:8000</span>).
            </div>
          </div>
        </div>
      </ContentArea>
    </>
  );
}
