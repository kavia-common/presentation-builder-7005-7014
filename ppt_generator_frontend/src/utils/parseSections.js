/**
 * Parses a multiline "Sections" text area into a slide list.
 * - Blank lines separate slides
 * - Each non-empty line becomes a bullet point
 */

// PUBLIC_INTERFACE
export function parseSectionsToSlides(text) {
  /**
   * @param {string} text
   * @returns {{ title?: string, bullets: string[] }[]}
   */
  const normalized = (text || "").replace(/\r\n/g, "\n");
  const blocks = normalized
    .split(/\n\s*\n/g) // blank line separates slides
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 0) return [];

  return blocks.map((block) => {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    // Simple heuristic: if first line ends with ":" treat it as slide title
    let title;
    let bullets = lines;
    if (lines[0] && lines[0].endsWith(":") && lines.length > 1) {
      title = lines[0].slice(0, -1).trim();
      bullets = lines.slice(1);
    }

    return { title, bullets };
  });
}
