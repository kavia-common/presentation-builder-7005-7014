import { getApiBaseUrl } from "../utils/env";
import { isMockForced, setForceMock } from "../utils/mockMode";

/**
 * API adapter for PPT generation.
 * - Uses backend API when configured and healthy
 * - Falls back to mock mode automatically when backend is unreachable or returns unusable responses
 * - Allows user override via Settings -> "Force mock mode"
 */

const MOCK_JOBS = new Map();

/**
 * Some runtimes/proxies/service workers can return objects that are not real `Response` instances.
 * We accept "Response-like" objects, but reject anything without the minimum fields we depend on.
 */
function isResponseLike(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.ok === "boolean" &&
    typeof obj.status === "number" &&
    typeof obj.headers === "object" &&
    typeof obj.text === "function"
  );
}

function getHeader(res, name) {
  try {
    // Headers instance
    if (res?.headers?.get) return res.headers.get(name) || "";
    // plain object fallback
    const key = Object.keys(res?.headers || {}).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? String(res.headers[key]) : "";
  } catch {
    return "";
  }
}

function isAllowedJsonContentType(contentType) {
  const ct = (contentType || "").toLowerCase();
  return ct.includes("application/json") || ct.includes("+json");
}

function isHtmlLikeContentType(contentType) {
  const ct = (contentType || "").toLowerCase();
  return ct.includes("text/html") || ct.includes("application/xhtml") || ct.includes("text/plain");
}

/**
 * Convert unknown thrown values into a stable Error message.
 */
function toErrorMessage(e) {
  if (e instanceof Error) return e.message;
  try {
    return typeof e === "string" ? e : JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/**
 * Build an actionable hint for common misconfiguration/network issues.
 */
function buildConfigHint() {
  const base = getApiBaseUrl();
  if (!base) {
    return "No API base URL is configured. Either enable mock mode by leaving it blank, or set REACT_APP_API_BASE / REACT_APP_BACKEND_URL to your backend (e.g. http://localhost:8000).";
  }
  return `Configured API base URL: ${base}. If this is wrong, update REACT_APP_API_BASE / REACT_APP_BACKEND_URL and restart the dev server.`;
}

/**
 * Classify common "backend unusable" scenarios (CORS/proxy/service-worker HTML fallbacks).
 * If true, the app should proceed with mock mode so users can keep working.
 */
function isBackendUnusableErrorMessage(message) {
  const m = (message || "").toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("network request failed") ||
    m.includes("load failed") ||
    m.includes("net::err") ||
    m.includes("cors") ||
    m.includes("unexpected content-type") ||
    m.includes("malformed json") ||
    m.includes("unexpected response object") ||
    m.includes("opaque response") ||
    m.includes("opaqueredirect") ||
    m.includes("blocked by client")
  );
}

/**
 * A small toast hook so api/client can surface concise fallback messages without changing UX.
 * Registered from App-level.
 */
let toastAdapter = null;

// PUBLIC_INTERFACE
export function setApiClientToastAdapter(adapter) {
  /**
   * Register toast callbacks for the API client.
   * @param {{info?:(title:string,message:string)=>void, error?:(title:string,message:string)=>void}} adapter
   */
  toastAdapter = adapter || null;
}

let didShowAutoFallbackToast = false;
function maybeToastAutoFallback(reasonMessage) {
  if (didShowAutoFallbackToast) return;
  didShowAutoFallbackToast = true;

  const base = getApiBaseUrl();
  if (!base) return;

  // Keep it concise, but actionable: show base URL + "update env + restart"
  const msg = [
    `Backend unreachable/unusable; continuing in mock mode.`,
    `API base: ${base}.`,
    `If this is wrong, update REACT_APP_API_BASE / REACT_APP_BACKEND_URL and restart the dev server.`,
  ]
    .filter(Boolean)
    .join(" ");

  if (toastAdapter?.info) toastAdapter.info("Using mock mode", msg);
  // Also log for debugging.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn("[ppt-generator] auto-fallback to mock mode:", reasonMessage);
  }
}

function shouldUseMock() {
  return isMockForced() || !getApiBaseUrl();
}

/**
 * A fetch wrapper that:
 * - never assumes fetch returned a valid Response
 * - detects "opaque" responses (common with CORS/service workers) as unusable
 */
async function safeFetch(url, options) {
  if (!url || typeof url !== "string") {
    throw new Error(`Network request could not be started: invalid URL. ${buildConfigHint()}`);
  }

  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    const msg = toErrorMessage(e);
    throw new Error(
      [
        "Network request failed.",
        msg ? `Details: ${msg}` : "",
        buildConfigHint(),
        "Also check: backend is running, URL is reachable, and CORS allows the frontend origin.",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  if (!isResponseLike(res)) {
    throw new Error(
      [
        "Network request returned an unexpected response object.",
        buildConfigHint(),
        "This can happen with misconfigured proxies/service workers, CORS blocks, or a non-standard fetch polyfill.",
      ].join(" ")
    );
  }

  // If CORS blocks, some browsers return an opaque response where you can't read headers/body.
  // Treat this as unusable so we can fall back to mock mode.
  const type = String(res.type || "");
  if (type === "opaque" || type === "opaqueredirect") {
    throw new Error(
      [
        `Opaque response received (type=${type}).`,
        "This commonly indicates CORS/service-worker/proxy interference.",
        buildConfigHint(),
      ].join(" ")
    );
  }

  return res;
}

/**
 * Read error body text safely (never throw).
 */
async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

/**
 * Read JSON with explicit allowlist and safe/snippet errors.
 * - Requires JSON content-type
 * - Handles HTML/proxy error pages gracefully
 */
async function safeReadJson(res, { expected = "application/json" } = {}) {
  const contentType = getHeader(res, "content-type");
  const bodyText = await safeReadText(res);

  if (!isAllowedJsonContentType(contentType)) {
    const snippet = bodyText ? bodyText.slice(0, 280) : "";
    const extra =
      isHtmlLikeContentType(contentType) || (snippet && snippet.trim().startsWith("<"))
        ? "It looks like an HTML page (often a proxy error or service worker fallback)."
        : "";

    throw new Error(
      [
        `Unexpected content-type from server (expected ${expected}).`,
        contentType ? `Received: ${contentType}.` : "No content-type header.",
        extra,
        snippet ? `Body: ${snippet}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  try {
    return JSON.parse(bodyText || "{}");
  } catch {
    const snippet = bodyText ? bodyText.slice(0, 280) : "";
    throw new Error(
      ["Server returned malformed JSON.", contentType ? `content-type: ${contentType}.` : "", snippet ? `Body: ${snippet}` : ""]
        .filter(Boolean)
        .join(" ")
    );
  }
}

/**
 * Emit one-line warning in development when env-based mock mode is used.
 */
(function warnIfMock() {
  if (process.env.NODE_ENV !== "production" && !getApiBaseUrl()) {
    // eslint-disable-next-line no-console
    console.warn("[ppt-generator] API base URL missing; using mock mode.");
  }
})();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createJobId() {
  return `job_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function initMockJob(jobId) {
  const now = Date.now();
  const timeline = [
    { at: now + 300, status: "queued", progress: 0 },
    { at: now + 1200, status: "processing", progress: 18 },
    { at: now + 2200, status: "processing", progress: 42 },
    { at: now + 3200, status: "processing", progress: 70 },
    { at: now + 4200, status: "processing", progress: 92 },
    { at: now + 5200, status: "done", progress: 100, downloadUrl: "/mock/presentation.pptx" },
  ];

  MOCK_JOBS.set(jobId, { timeline, createdAt: now, payload: null });
}

function computeMockStatus(jobId) {
  const job = MOCK_JOBS.get(jobId);
  if (!job) {
    return {
      status: "error",
      progress: 0,
      errorMessage: "Mock job not found",
    };
  }
  const t = Date.now();
  const next = job.timeline.findLast ? job.timeline.findLast((e) => e.at <= t) : job.timeline.filter((e) => e.at <= t).slice(-1)[0];

  if (!next) {
    return { status: "queued", progress: 0 };
  }
  return {
    status: next.status,
    progress: typeof next.progress === "number" ? next.progress : undefined,
    downloadUrl: next.downloadUrl,
    errorMessage: next.errorMessage,
  };
}

async function submitGenerationReal(payload) {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, "")}/generate`;

  const res = await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await safeReadText(res);
    const snippet = text ? text.slice(0, 280) : "";
    throw new Error(
      [`Failed to submit generation (HTTP ${res.status}).`, snippet ? `Server says: ${snippet}` : "", buildConfigHint()]
        .filter(Boolean)
        .join(" ")
    );
  }

  return safeReadJson(res, { expected: "application/json" });
}

async function getStatusReal(jobId) {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, "")}/status/${encodeURIComponent(jobId)}`;

  const res = await safeFetch(url, { method: "GET" });

  if (!res.ok) {
    const text = await safeReadText(res);
    const snippet = text ? text.slice(0, 280) : "";
    throw new Error(
      [`Failed to get status (HTTP ${res.status}).`, snippet ? `Server says: ${snippet}` : "", buildConfigHint()]
        .filter(Boolean)
        .join(" ")
    );
  }

  return safeReadJson(res, { expected: "application/json" });
}

/**
 * Run an API call but fall back to mock mode if the backend is unreachable/unusable.
 * This intentionally persists force-mock so subsequent calls (polling) keep working.
 */
async function withAutoMockFallback(realCall, mockCall) {
  if (shouldUseMock()) return mockCall();

  try {
    return await realCall();
  } catch (e) {
    const msg = toErrorMessage(e);
    if (isBackendUnusableErrorMessage(msg)) {
      // Persist fallback so the whole flow continues (submit + poll) without breaking.
      setForceMock(true);
      maybeToastAutoFallback(msg);
      return mockCall();
    }
    throw e;
  }
}

// PUBLIC_INTERFACE
export async function submitGeneration(payload) {
  /**
   * Submit a generation request.
   * @param {object} payload - Generation payload.
   * @returns {Promise<{jobId?: string, downloadUrl?: string}>}
   */
  return withAutoMockFallback(
    async () => submitGenerationReal(payload),
    async () => {
      const jobId = createJobId();
      initMockJob(jobId);
      const job = MOCK_JOBS.get(jobId);
      job.payload = payload;

      // small delay to mimic network
      await sleep(250);
      return { jobId };
    }
  );
}

// PUBLIC_INTERFACE
export async function getStatus(jobId) {
  /**
   * Get status for a generation job.
   * @param {string} jobId
   * @returns {Promise<{status:'queued'|'processing'|'done'|'error', progress?:number, downloadUrl?:string, errorMessage?:string}>}
   */
  return withAutoMockFallback(
    async () => getStatusReal(jobId),
    async () => {
      await sleep(180);
      return computeMockStatus(jobId);
    }
  );
}

