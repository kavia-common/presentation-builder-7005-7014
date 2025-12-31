/**
 * Download helper:
 * - If same-origin path or mock, create a Blob and trigger download.
 * - If cross-origin, try fetch->blob (if CORS allows) else open new tab.
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

async function fetchAsBlob(url) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
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
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }
}
