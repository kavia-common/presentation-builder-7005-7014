import { getApiBaseUrl, isMockMode } from "../utils/env";

/**
 * API adapter for PPT generation.
 * In mock mode it simulates an async job with incremental progress.
 */

const MOCK_JOBS = new Map();

/**
 * Response-like detection:
 * Some runtimes/proxies/service workers can return objects that are not real `Response` instances,
 * but still implement the same interface surface. We accept "Response-like" objects, but reject
 * anything without the minimum fields we depend on.
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

function isProbablyJson(contentType) {
  const ct = (contentType || "").toLowerCase();
  return ct.includes("application/json") || ct.includes("+json");
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
 * A fetch wrapper that:
 * - never assumes fetch returned a valid Response
 * - provides actionable errors for bad/missing base URLs, CORS, proxy issues, etc.
 */
async function safeFetch(url, options) {
  // Catch empty/invalid URL early with a better error message.
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
 * Try to parse JSON only when the server claims it's JSON.
 * If parsing fails, return { ok:false, ... } with helpful context.
 */
async function safeReadJson(res, { expected = "json" } = {}) {
  const contentType = getHeader(res, "content-type");
  const bodyText = await safeReadText(res);

  if (!isProbablyJson(contentType)) {
    // Backend might return HTML error pages (reverse proxy) or plain text.
    const snippet = bodyText ? bodyText.slice(0, 280) : "";
    throw new Error(
      [
        `Unexpected content-type from server (expected ${expected}).`,
        contentType ? `Received: ${contentType}.` : "No content-type header.",
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
      [
        "Server returned malformed JSON.",
        contentType ? `content-type: ${contentType}.` : "",
        snippet ? `Body: ${snippet}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
}

/**
 * Emit one-line warning in development when mock mode is used.
 * (Requirement: log a one-line warning in dev when both API_BASE and BACKEND_URL are missing)
 */
(function warnIfMock() {
  if (process.env.NODE_ENV !== "production" && isMockMode()) {
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
      [
        `Failed to submit generation (HTTP ${res.status}).`,
        snippet ? `Server says: ${snippet}` : "",
        buildConfigHint(),
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  // Success path: still validate content-type to avoid "unexpected response object" follow-up errors
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
      [
        `Failed to get status (HTTP ${res.status}).`,
        snippet ? `Server says: ${snippet}` : "",
        buildConfigHint(),
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  return safeReadJson(res, { expected: "application/json" });
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
  const next = job.timeline.findLast
    ? job.timeline.findLast((e) => e.at <= t)
    : job.timeline.filter((e) => e.at <= t).slice(-1)[0];

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

// PUBLIC_INTERFACE
export async function submitGeneration(payload) {
  /**
   * Submit a generation request.
   * @param {object} payload - Generation payload.
   * @returns {Promise<{jobId?: string, downloadUrl?: string}>}
   */
  if (isMockMode()) {
    const jobId = createJobId();
    initMockJob(jobId);
    const job = MOCK_JOBS.get(jobId);
    job.payload = payload;

    // small delay to mimic network
    await sleep(250);
    return { jobId };
  }
  return submitGenerationReal(payload);
}

// PUBLIC_INTERFACE
export async function getStatus(jobId) {
  /**
   * Get status for a generation job.
   * @param {string} jobId
   * @returns {Promise<{status:'queued'|'processing'|'done'|'error', progress?:number, downloadUrl?:string, errorMessage?:string}>}
   */
  if (isMockMode()) {
    await sleep(180);
    return computeMockStatus(jobId);
  }
  return getStatusReal(jobId);
}
