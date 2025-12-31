/**
 * Mock mode override (force mock) stored in localStorage.
 * This is intentionally separate from env.js because env vars are build-time in CRA,
 * while force-mock is a runtime debugging toggle.
 */

const FORCE_MOCK_KEY = "ppt_generator_forceMock";

// PUBLIC_INTERFACE
export function getForceMock() {
  /**
   * Returns whether the user has enabled "Force mock mode" in localStorage.
   * @returns {boolean}
   */
  try {
    return window.localStorage.getItem(FORCE_MOCK_KEY) === "true";
  } catch {
    return false;
  }
}

// PUBLIC_INTERFACE
export function setForceMock(value) {
  /**
   * Persists the "Force mock mode" toggle in localStorage.
   * @param {boolean} value
   */
  try {
    window.localStorage.setItem(FORCE_MOCK_KEY, value ? "true" : "false");
  } catch {
    // ignore storage failures (private mode / disabled storage)
  }
}

// PUBLIC_INTERFACE
export function isMockForced() {
  /**
   * Alias for getForceMock(), for readability in calling sites.
   * @returns {boolean}
   */
  return getForceMock();
}

// PUBLIC_INTERFACE
export function clearForceMock() {
  /**
   * Clears the force-mock override.
   */
  try {
    window.localStorage.removeItem(FORCE_MOCK_KEY);
  } catch {
    // ignore
  }
}

