/**
 * Download helper:
 * - If same-origin path or mock, create a Blob and trigger download.
 * - If cross-origin, try fetch->blob (if CORS allows) else open new tab.
 *
 * Hardened to:
 * - validate Response-like objects
 * - handle non-2xx with readable server messages
 * - detect unexpected content-types (HTML/JSON error pages) before saving as .pptx
 */

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

function isSameOrigin(url) {
  try {
    // relative url is same origin by definition
    if (!isHttpUrl(url)) return true;
    const u = new URL(url);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

function isResponseLike(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.ok === "boolean" &&
    typeof obj.status === "number" &&
    typeof obj.headers === "object" &&
    typeof obj.blob === "function" &&
    typeof obj.text === "function"
  );
}

function getHeader(res, name) {
  try {
    if (res?.headers?.get) return res.headers.get(name) || "";
    const key = Object.keys(res?.headers || {}).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? String(res.headers[key]) : "";
  } catch {
    return "";
  }
}

function triggerBlobDownload(blob, filename) {
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function looksLikePptxContentType(ct) {
  const v = (ct || "").toLowerCase();
  return (
    v.includes("application/vnd.openxmlformats-officedocument.presentationml.presentation") ||
    v.includes("application/octet-stream")
  );
}

async function fetchAsBlob(url) {
  let res;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      [
        "Download failed due to a network error.",
        msg ? `Details: ${msg}` : "",
        "If this is cross-origin, ensure the backend enables CORS for file downloads.",
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

  if (!res.ok) {
    const text = await safeReadText(res);
    const snippet = text ? text.slice(0, 280) : "";
    throw new Error(
      [`Download failed (HTTP ${res.status}).`, snippet ? `Server says: ${snippet}` : ""].filter(Boolean).join(" ")
    );
  }

  // Detect common "success but actually an error page" scenarios.
  const contentType = getHeader(res, "content-type");
  if (contentType && !looksLikePptxContentType(contentType)) {
    const text = await safeReadText(res);
    const snippet = text ? text.slice(0, 280) : "";
    throw new Error(
      [
        "Download failed: server returned an unexpected content-type instead of a .pptx file.",
        `content-type: ${contentType}.`,
        snippet ? `Body: ${snippet}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  return res.blob();
}

// PUBLIC_INTERFACE
export async function downloadPresentation(downloadUrl, filename = "generated_presentation.pptx") {
  /**
   * Downloads the pptx file. Throws on failure.
   * @param {string} downloadUrl
   * @param {string} filename
   */
  if (!downloadUrl) throw new Error("Missing download URL");

  // Mock path: generate a tiny placeholder pptx-like blob.
  if (downloadUrl.startsWith("/mock/")) {
    const content = `Mock PPTX file placeholder.\nGenerated at: ${new Date().toISOString()}\n`;
    const blob = new Blob([content], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    triggerBlobDownload(blob, filename);
    return;
  }

  // Same-origin relative or absolute URL: attempt fetch->blob for best UX.
  if (isSameOrigin(downloadUrl)) {
    const blob = await fetchAsBlob(downloadUrl);
    triggerBlobDownload(blob, filename);
    return;
  }

  // Cross-origin: try fetch (may fail due to CORS), else open in a new tab.
  try {
    const blob = await fetchAsBlob(downloadUrl);
    triggerBlobDownload(blob, filename);
  } catch (e) {
    // If CORS blocks fetch, opening the direct URL is often the best fallback.
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }
}
