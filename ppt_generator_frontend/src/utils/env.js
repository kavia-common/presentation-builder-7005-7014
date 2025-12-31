/**
 * Centralized env access for CRA. All values are read from process.env at build time.
 *
 * NOTE: A runtime "Force mock mode" override exists (stored in localStorage) in utils/mockMode.js.
 * Keep env.js strictly build-time so behavior is predictable across deployments.
 */

// PUBLIC_INTERFACE
export function getApiBaseUrl() {
  /** Returns configured API base URL or empty string. Prefers REACT_APP_API_BASE over REACT_APP_BACKEND_URL. */
  const apiBase = process.env.REACT_APP_API_BASE;
  const backend = process.env.REACT_APP_BACKEND_URL;
  return (apiBase && apiBase.trim()) || (backend && backend.trim()) || "";
}

// PUBLIC_INTERFACE
export function getWsUrl() {
  /** Returns configured WebSocket URL (optional, for future use). */
  const ws = process.env.REACT_APP_WS_URL;
  return (ws && ws.trim()) || "";
}

// PUBLIC_INTERFACE
export function isMockMode() {
  /** Mock mode is enabled when no API base env var is configured. */
  return !getApiBaseUrl();
}
