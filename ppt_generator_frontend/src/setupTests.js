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
  // Optional dependency; ignore if missing.
}
