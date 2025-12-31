/**
 * Download helper:
 * - Fetch->blob when possible (works best with authenticated endpoints and avoids popups).
 * - Validate HTTP status and detect common "HTML/JSON error page" responses before saving.
 * - Extract filename from Content-Disposition with a safe fallback.
 * - Cross-origin fallback: attempt HEAD to validate; fall back to GET; if blocked, open new tab.
 */

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const ALLOWED_DOWNLOAD_CONTENT_TYPES = [
  "application/octet-stream",
  PPTX_MIME,
];

/**
 * Minimal check for an absolute http(s) URL.
 */
function isHttpUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

/**
 * Returns true for same-origin URLs, including relative URLs.
 */
function isSameOrigin(url) {
  try {
    if (!isHttpUrl(url)) return true;
    const u = new URL(url);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
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
    if (res?.headers?.get) return res.headers.get(name) || "";
    const key = Object.keys(res?.headers || {}).find(
      (k) => k.toLowerCase() === name.toLowerCase()
    );
    return key ? String(res.headers[key]) : "";
  } catch {
    return "";
  }
}

function isAllowedPptxContentType(contentType) {
  const ct = (contentType || "").toLowerCase();
  if (!ct) return true; // some backends omit content-type for downloads; don't hard-fail
  return ALLOWED_DOWNLOAD_CONTENT_TYPES.some((allowed) =>
    ct.includes(allowed.toLowerCase())
  );
}

function looksLikeHtmlOrJson(contentType, bodySnippet) {
  const ct = (contentType || "").toLowerCase();
  const snip = (bodySnippet || "").trim().toLowerCase();

  if (ct.includes("text/html") || ct.includes("application/xhtml")) return true;
  if (ct.includes("application/json") || ct.includes("+json")) return true;
  if (ct.includes("text/plain") && (snip.startsWith("<!doctype") || snip.startsWith("<html")))
    return true;

  // Content-type missing but body looks like HTML/JSON
  if (!ct && (snip.startsWith("<!doctype") || snip.startsWith("<html"))) return true;
  if (!ct && (snip.startsWith("{") || snip.startsWith("["))) return true;

  return false;
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

/**
 * RFC5987 filename*=UTF-8''... support plus classic filename="..."
 */
function extractFilenameFromContentDisposition(contentDisposition) {
  const cd = contentDisposition || "";
  if (!cd) return "";

  // filename*=UTF-8''encoded.ext
  const starMatch = cd.match(/filename\*\s*=\s*([^;]+)/i);
  if (starMatch && starMatch[1]) {
    const raw = starMatch[1].trim();
    // e.g. UTF-8''generated%20deck.pptx
    const parts = raw.split("''");
    if (parts.length === 2) {
      try {
        const decoded = decodeURIComponent(parts[1].replace(/^"|"$/g, ""));
        return sanitizeFilename(decoded);
      } catch {
        // fall back to other parsing
      }
    }
  }

  // filename="file.ext" or filename=file.ext
  const match = cd.match(/filename\s*=\s*("?)([^";]+)\1/i);
  if (match && match[2]) return sanitizeFilename(match[2].trim());

  return "";
}

function sanitizeFilename(name) {
  const n = (name || "").trim();
  if (!n) return "";
  // Prevent path traversal / odd characters. Keep it conservative.
  return n.replace(/[/\\?%*:|"<>]/g, "_");
}

function ensurePptxExtension(filename) {
  const f = (filename || "").trim();
  if (!f) return "";
  return f.toLowerCase().endsWith(".pptx") ? f : `${f}.pptx`;
}

function defaultFilename(prefix = "generated") {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${ts}.pptx`;
}

function triggerBlobDownload(blob, filename) {
  const safeName = ensurePptxExtension(filename || defaultFilename("generated"));
  const blobUrl = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = safeName;

  // In some browsers, the click must happen while attached to DOM.
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Give the browser a moment to start reading the object URL before revoking.
  window.setTimeout(() => {
    try {
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // ignore
    }
  }, 500);
}

function buildMockPptxLikeBlobBytes() {
  /**
   * This is not a full PPTX (which is a ZIP container), but it:
   * - uses correct mime type
   * - has .pptx extension
   * - provides a non-empty binary-ish payload so download is realistic
   */
  const header = new TextEncoder().encode(
    `PPTX-MOCK\nGenerated: ${new Date().toISOString()}\n\n`
  );

  // Add some bytes to look like a "binary file" (still valid as blob data).
  const tail = new Uint8Array(256);
  for (let i = 0; i < tail.length; i += 1) tail[i] = (i * 31) % 256;

  return new Blob([header, tail], { type: PPTX_MIME });
}

async function safeFetch(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    const msg = toErrorMessage(e);
    throw new Error(
      [
        "Download failed due to a network error.",
        msg ? `Details: ${msg}` : "",
        "If this is cross-origin, ensure the backend enables CORS for file downloads (and credentials if needed).",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  if (!isResponseLike(res)) {
    throw new Error(
      "Download failed: the network layer returned an unexpected response object. This may be caused by a proxy/service worker or a non-standard fetch implementation."
    );
  }

  const type = String(res.type || "");
  if (type === "opaque" || type === "opaqueredirect") {
    throw new Error(
      `Download failed: opaque response received (type=${type}). This commonly indicates CORS/service-worker/proxy interference.`
    );
  }

  return res;
}

async function fetchValidatedBlob(url, { credentials = "same-origin" } = {}) {
  const res = await safeFetch(url, {
    method: "GET",
    credentials,
  });

  if (!res.ok) {
    const text = await safeReadText(res);
    const snippet = text ? text.slice(0, 280) : "";
    throw new Error(
      [`Download failed (HTTP ${res.status}).`, snippet ? `Server says: ${snippet}` : ""]
        .filter(Boolean)
        .join(" ")
    );
  }

  const contentType = getHeader(res, "content-type");
  const contentDisposition = getHeader(res, "content-disposition");

  // If server tells us it's not a PPTX-like payload, try to read it as text and error out.
  // This avoids saving "index.html" or {"detail":"..."} as a .pptx file.
  if (contentType && !isAllowedPptxContentType(contentType)) {
    const text = await safeReadText(res);
    const snippet = text ? text.slice(0, 280) : "";
    const extra = looksLikeHtmlOrJson(contentType, snippet)
      ? "It looks like an error payload (HTML/JSON) rather than a PPTX file."
      : "";

    throw new Error(
      [
        "Download failed: server returned an unexpected content-type instead of a .pptx file.",
        `content-type: ${contentType}.`,
        extra,
        snippet ? `Body: ${snippet}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  const blob = await res.blob();

  // Extra guard: when content-type is missing, some proxies still return HTML.
  // Checking just the first bytes helps prevent saving HTML.
  if (!contentType) {
    try {
      const previewText = await blob.slice(0, 256).text();
      const snippet = previewText ? previewText.slice(0, 256) : "";
      if (looksLikeHtmlOrJson(contentType, snippet)) {
        throw new Error(
          [
            "Download failed: response looked like HTML/JSON rather than a PPTX file.",
            snippet ? `Body: ${snippet}` : "",
          ]
            .filter(Boolean)
            .join(" ")
        );
      }
    } catch (e) {
      // if preview fails, ignore and proceed with blob download
      if (e instanceof Error && e.message.includes("response looked like")) throw e;
    }
  }

  const headerName = extractFilenameFromContentDisposition(contentDisposition);
  return { blob, filenameFromHeader: headerName, contentType };
}

/**
 * Attempt a HEAD to validate "is this probably a file".
 * Many servers block HEAD; treat as optional best-effort.
 */
async function tryHeadValidate(url, { credentials = "same-origin" } = {}) {
  try {
    const res = await safeFetch(url, { method: "HEAD", credentials });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };

    const ct = getHeader(res, "content-type");
    // We don't hard-require content-type on HEAD; just use it as a signal.
    if (ct && !isAllowedPptxContentType(ct)) {
      return { ok: false, reason: `Unexpected content-type: ${ct}` };
    }

    const cd = getHeader(res, "content-disposition");
    const headerName = extractFilenameFromContentDisposition(cd);

    return { ok: true, contentType: ct, filenameFromHeader: headerName };
  } catch (e) {
    return { ok: false, reason: toErrorMessage(e) };
  }
}

// PUBLIC_INTERFACE
export async function downloadPresentation(downloadUrl, filename = "") {
  /**
   * Downloads a PPTX file (or triggers a fallback).
   * - Uses robust blob downloading when possible.
   * - For cross-origin URLs that block fetch/headers (CORS), falls back to opening a new tab.
   *
   * @param {string} downloadUrl - URL (relative or absolute) to the .pptx file.
   * @param {string} filename - Optional preferred filename; may be overridden by server header.
   */
  if (!downloadUrl) throw new Error("Missing download URL");

  // Mock path: generate a tiny pptx-like blob and download it.
  if (downloadUrl.startsWith("/mock/")) {
    const blob = buildMockPptxLikeBlobBytes();
    triggerBlobDownload(blob, filename || defaultFilename("generated"));
    return;
  }

  const preferredName = ensurePptxExtension(
    sanitizeFilename(filename || "") || defaultFilename("generated")
  );

  // For best compatibility with backends requiring cookies: include credentials on same-origin.
  // For cross-origin, credentials may be required but also require CORS allow-credentials.
  const credentials = isSameOrigin(downloadUrl) ? "same-origin" : "include";

  // If cross-origin, try an optional HEAD first (best-effort) to detect obvious problems.
  // If HEAD blocked, continue with GET path.
  if (!isSameOrigin(downloadUrl)) {
    await tryHeadValidate(downloadUrl, { credentials });
  }

  // Primary path: GET -> blob -> download.
  try {
    const { blob, filenameFromHeader } = await fetchValidatedBlob(downloadUrl, {
      credentials,
    });

    const finalName =
      ensurePptxExtension(filenameFromHeader) ||
      preferredName ||
      defaultFilename("generated");

    triggerBlobDownload(blob, finalName);
    return;
  } catch (e) {
    // CORS or other issues: as a fallback, open direct URL in a new tab.
    // This often works when fetch is blocked but browser navigation is allowed.
    if (!isSameOrigin(downloadUrl)) {
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    throw e;
  }
}

// PUBLIC_INTERFACE
export async function downloadSelfTestPptx({ filenamePrefix = "download-self-test" } = {}) {
  /**
   * Manual self-test: triggers a real browser download using a locally generated blob.
   * This verifies that the user agent allows downloads, object URLs, and "click to save".
   *
   * @param {{filenamePrefix?: string}} options
   */
  const blob = buildMockPptxLikeBlobBytes();
  triggerBlobDownload(blob, defaultFilename(filenamePrefix));
}
