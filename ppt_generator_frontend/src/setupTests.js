/**
 * Optional jest-dom setup.
 *
 * Some execution environments for this repo may not include @testing-library/jest-dom.
 * To keep the test runner from crashing, we attempt to require it dynamically.
 */
try {
  // eslint-disable-next-line global-require
  require("@testing-library/jest-dom");
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn("[ppt-generator] Optional dependency @testing-library/jest-dom not available; continuing without it.");
}
