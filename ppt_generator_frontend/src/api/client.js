import { getApiBaseUrl, isMockMode } from "../utils/env";

/**
 * API adapter for PPT generation.
 * In mock mode it simulates an async job with incremental progress.
 */

const MOCK_JOBS = new Map();

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
  const res = await fetch(`${base.replace(/\/$/, "")}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to submit generation (HTTP ${res.status})`);
  }
  return res.json();
}

async function getStatusReal(jobId) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base.replace(/\/$/, "")}/status/${encodeURIComponent(jobId)}`, {
    method: "GET",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to get status (HTTP ${res.status})`);
  }
  return res.json();
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
