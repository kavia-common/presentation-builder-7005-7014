import React, { useEffect, useMemo, useRef, useState } from "react";
import Topbar from "../components/Topbar";
import ContentArea from "../components/ContentArea";
import ProgressBar from "../components/ProgressBar";
import { submitGeneration, getStatus } from "../api/client";
import { parseSectionsToSlides } from "../utils/parseSections";
import { downloadPresentation } from "../utils/download";
import { useToasts } from "../context/ToastContext";

const TEMPLATES = [
  { value: "Corporate", label: "Corporate" },
  { value: "Minimal", label: "Minimal" },
  { value: "Bold", label: "Bold" },
];

const THEME_VARIANTS = [
  { value: "Light", label: "Light" },
  { value: "Dark", label: "Dark" },
];

function validate({ title, sections }) {
  const errs = {};
  if (!title.trim()) errs.title = "Presentation title is required.";
  if (!sections.trim()) errs.sections = "Please enter at least one section/bullet.";
  return errs;
}

// PUBLIC_INTERFACE
export default function Generate() {
  /** Core generation UI: form -> submit -> poll -> download. */
  const toasts = useToasts();

  const [title, setTitle] = useState("");
  const [sections, setSections] = useState("");

  const [template, setTemplate] = useState("Corporate");
  const [slideCount, setSlideCount] = useState("");
  const [includeImages, setIncludeImages] = useState(false);
  const [themeVariant, setThemeVariant] = useState("Light");

  const [errors, setErrors] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState("");
  const [statusText, setStatusText] = useState("Ready.");
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [inlineError, setInlineError] = useState("");

  const pollTimerRef = useRef(null);

  const slidesPreview = useMemo(() => {
    const slides = parseSectionsToSlides(sections);
    return slides.slice(0, 3);
  }, [sections]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  async function startPolling(createdJobId) {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const s = await getStatus(createdJobId);
        const p = typeof s.progress === "number" ? s.progress : progress;

        setProgress((prev) => (typeof s.progress === "number" ? s.progress : prev));
        setStatusText(
          s.status === "queued"
            ? "Queued…"
            : s.status === "processing"
            ? `Generating… ${p}%`
            : s.status === "done"
            ? "Generation complete."
            : "Error."
        );

        if (s.status === "done") {
          setIsGenerating(false);
          setProgress(100);
          setDownloadUrl(s.downloadUrl || "");
          toasts.success("Presentation ready", "Your file is ready to download.");
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }

        if (s.status === "error") {
          setIsGenerating(false);
          setInlineError(s.errorMessage || "Generation failed.");
          toasts.error("Generation failed", s.errorMessage || "Please try again.");
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      } catch (e) {
        setIsGenerating(false);
        const msg = e instanceof Error ? e.message : "Failed to get job status.";
        setInlineError(msg);
        toasts.error("Status check failed", msg);
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    }, 1400);
  }

  async function onGenerate(e) {
    e.preventDefault();
    setInlineError("");
    setDownloadUrl("");
    setJobId("");
    setProgress(0);

    const v = validate({ title, sections });
    setErrors(v);
    if (Object.keys(v).length) {
      toasts.error("Fix form errors", "Please correct the highlighted fields.");
      return;
    }

    const slides = parseSectionsToSlides(sections);

    const payload = {
      title: title.trim(),
      slides,
      options: {
        template,
        slideCount: slideCount ? Number(slideCount) : undefined,
        includeImages,
        themeVariant,
      },
    };

    setIsGenerating(true);
    setStatusText("Submitting…");

    try {
      const res = await submitGeneration(payload);

      if (res.downloadUrl) {
        setIsGenerating(false);
        setProgress(100);
        setStatusText("Generation complete.");
        setDownloadUrl(res.downloadUrl);
        toasts.success("Presentation ready", "Your file is ready to download.");
        return;
      }

      if (!res.jobId) {
        throw new Error("Unexpected response: missing jobId/downloadUrl");
      }

      setJobId(res.jobId);
      setStatusText("Queued…");
      setProgress(0);
      await startPolling(res.jobId);
    } catch (err) {
      setIsGenerating(false);
      const msg = err instanceof Error ? err.message : "Generation failed.";
      setInlineError(msg);
      setStatusText("Error.");
      toasts.error("Generation failed", msg);
    }
  }

  function onReset() {
    if (isGenerating) return;
    setTitle("");
    setSections("");
    setTemplate("Corporate");
    setSlideCount("");
    setIncludeImages(false);
    setThemeVariant("Light");
    setErrors({});
    setInlineError("");
    setProgress(0);
    setStatusText("Ready.");
    setJobId("");
    setDownloadUrl("");
  }

  async function onDownload() {
    try {
      await downloadPresentation(downloadUrl, "generated_presentation.pptx");
      toasts.success("Download started", "If the download doesn't start, check popup settings.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Download failed.";
      toasts.error("Download failed", msg);
    }
  }

  const disabled = isGenerating;

  return (
    <>
      <Topbar
        title="Generate Presentation"
        subtitle="Enter structured content, choose options, then generate a .pptx file."
        right={
          <span className="chip">
            Tip: separate slides with a blank line <span className="kbd">⏎⏎</span>
          </span>
        }
      />

      <ContentArea>
        <div className="grid2">
          <section className="card" aria-label="Generation form">
            <div className="cardHeader">
              <h2>Content</h2>
              <span>{disabled ? "Locked while generating" : "Editable"}</span>
            </div>

            <form onSubmit={onGenerate}>
              <div className="formRow">
                <label htmlFor="title">Presentation Title</label>
                <input
                  id="title"
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q1 Business Review"
                  disabled={disabled}
                  aria-invalid={Boolean(errors.title)}
                />
                {errors.title ? <div className="inlineError">{errors.title}</div> : null}
              </div>

              <div className="formRow">
                <label htmlFor="sections">Sections</label>
                <textarea
                  id="sections"
                  className="textarea"
                  value={sections}
                  onChange={(e) => setSections(e.target.value)}
                  placeholder={
                    "Slide 1 Title:\n- bullet 1\n- bullet 2\n\nSlide 2 Title:\n- bullet 1\n- bullet 2"
                  }
                  disabled={disabled}
                  aria-invalid={Boolean(errors.sections)}
                />
                <div className="helpText">
                  Each blank line creates a new slide. Each non-empty line becomes a bullet. Optional: use “Title:” on
                  the first line for slide titles.
                </div>
                {errors.sections ? <div className="inlineError">{errors.sections}</div> : null}
              </div>

              <div className="formRow2">
                <div className="formRow">
                  <label htmlFor="template">Template</label>
                  <select
                    id="template"
                    className="select"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    disabled={disabled}
                  >
                    {TEMPLATES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="formRow">
                  <label htmlFor="slideCount">Slide Count (optional)</label>
                  <input
                    id="slideCount"
                    className="input"
                    type="number"
                    min={1}
                    value={slideCount}
                    onChange={(e) => setSlideCount(e.target.value)}
                    placeholder="auto"
                    disabled={disabled}
                  />
                </div>
              </div>

              <div className="formRow2">
                <div className="formRow">
                  <label htmlFor="themeVariant">Theme Variant</label>
                  <select
                    id="themeVariant"
                    className="select"
                    value={themeVariant}
                    onChange={(e) => setThemeVariant(e.target.value)}
                    disabled={disabled}
                  >
                    {THEME_VARIANTS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="formRow">
                  <label>Options</label>
                  <div className="checkboxRow">
                    <input
                      id="includeImages"
                      type="checkbox"
                      checked={includeImages}
                      onChange={(e) => setIncludeImages(e.target.checked)}
                      disabled={disabled}
                    />
                    <label htmlFor="includeImages" style={{ fontWeight: 600 }}>
                      Include images
                    </label>
                  </div>
                  <div className="helpText">Mock mode ignores images; real backend may use this later.</div>
                </div>
              </div>

              {inlineError ? <div className="inlineError" style={{ marginTop: 8 }}>{inlineError}</div> : null}

              <div className="actionsRow">
                <button className="btn btnPrimary" type="submit" disabled={disabled}>
                  {disabled ? "Generating…" : "Generate"}
                </button>
                <button className="btn btnSecondary" type="button" onClick={onReset} disabled={disabled}>
                  Reset
                </button>

                {downloadUrl ? (
                  <button className="btn btnLink" type="button" onClick={onDownload}>
                    Download .pptx
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <aside className="card" aria-label="Preview and status">
            <div className="cardHeader">
              <h2>Status</h2>
              <span>{jobId ? `Job: ${jobId}` : "No job"}</span>
            </div>

            <div className="progressWrap" aria-live="polite" aria-atomic="true">
              <ProgressBar value={progress} />
              <div className="helpText">{statusText}</div>
              {downloadUrl ? (
                <div className="helpText">
                  Ready to download: <span className="kbd">generated_presentation.pptx</span>
                </div>
              ) : null}
            </div>

            <div style={{ height: 12 }} />

            <div className="cardHeader">
              <h2>Preview</h2>
              <span>placeholder</span>
            </div>
            <div className="previewThumb" aria-label="Preview thumbnail placeholder">
              PPTX
            </div>

            <div className="miniMeta">
              <div>Slides detected: <strong>{parseSectionsToSlides(sections).length}</strong></div>
              <div>Preview sample: <strong>{slidesPreview.length}</strong> slides</div>
              <div style={{ color: "var(--muted)" }}>
                Note: Thumbnail rendering will be added when a backend provides images.
              </div>
            </div>
          </aside>
        </div>
      </ContentArea>
    </>
  );
}
