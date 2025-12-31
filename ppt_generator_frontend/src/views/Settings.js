import React, { useEffect, useMemo, useState } from "react";
import Topbar from "../components/Topbar";
import ContentArea from "../components/ContentArea";
import { getApiBaseUrl, getWsUrl } from "../utils/env";
import { getForceMock, setForceMock } from "../utils/mockMode";

// PUBLIC_INTERFACE
export default function Settings() {
  /** Basic settings page: shows configured env URLs, effective mode, and allows force-mock override. */
  const [forceMock, setForceMockState] = useState(getForceMock());

  useEffect(() => {
    setForceMockState(getForceMock());
  }, []);

  const info = useMemo(() => {
    const api = getApiBaseUrl();
    const ws = getWsUrl();

    const envMock = !api;
    const effectiveMock = forceMock || envMock;

    return {
      api: api || "(not set)",
      ws: ws || "(not set)",
      envMock: envMock ? "enabled" : "disabled",
      effectiveMock: effectiveMock ? "enabled" : "disabled",
    };
  }, [forceMock]);

  function onToggleForceMock(next) {
    setForceMock(next);
    setForceMockState(next);
  }

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
              <label>Mock mode (env)</label>
              <div className="helpText">
                <strong>{info.envMock}</strong> — env mock mode is used when <span className="kbd">REACT_APP_API_BASE</span>{" "}
                and <span className="kbd">REACT_APP_BACKEND_URL</span> are not set.
              </div>
            </div>

            <div className="formRow">
              <label>Force mock mode (debug)</label>
              <div className="checkboxRow">
                <input
                  id="forceMock"
                  type="checkbox"
                  checked={forceMock}
                  onChange={(e) => onToggleForceMock(e.target.checked)}
                />
                <label htmlFor="forceMock" style={{ fontWeight: 600 }}>
                  Always use mock flow (ignore backend)
                </label>
              </div>
              <div className="helpText">
                Useful if the configured backend URL is unreachable, blocked by CORS, or intercepted by a proxy/service worker.
              </div>
            </div>

            <div className="formRow">
              <label>Effective mode</label>
              <div className="helpText">
                <strong>{info.effectiveMock}</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <h2>Notes</h2>
              <span>help</span>
            </div>
            <div className="helpText" style={{ lineHeight: 1.6 }}>
              The frontend is designed to work even without a backend. In mock mode, generation simulates progress and produces a
              placeholder <span className="kbd">.pptx</span> download.
              <br />
              <br />
              If your backend supports it, configure <span className="kbd">REACT_APP_API_BASE</span> to point to the API (e.g.{" "}
              <span className="kbd">http://localhost:8000</span>).
              <br />
              <br />
              If you see network/CORS/proxy errors, enable <strong>Force mock mode</strong> to continue using the app while you fix
              the backend URL and restart the dev server.
            </div>
          </div>
        </div>
      </ContentArea>
    </>
  );
}

