import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

function createId() {
  return `toast_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

// PUBLIC_INTERFACE
export function ToastProvider({ children }) {
  /** Provides toast helpers and renders a fixed toast viewport. */
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    ({ type = "info", title, message, timeoutMs = 4500 }) => {
      const id = createId();
      setToasts((prev) => [{ id, type, title, message }, ...prev].slice(0, 4));

      if (timeoutMs > 0) {
        const t = setTimeout(() => removeToast(id), timeoutMs);
        timers.current.set(id, t);
      }
      return id;
    },
    [removeToast]
  );

  const api = useMemo(
    () => ({
      toasts,
      pushToast,
      removeToast,
      info: (title, message, timeoutMs) => pushToast({ type: "info", title, message, timeoutMs }),
      success: (title, message, timeoutMs) => pushToast({ type: "success", title, message, timeoutMs }),
      error: (title, message, timeoutMs) => pushToast({ type: "error", title, message, timeoutMs }),
    }),
    [toasts, pushToast, removeToast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toastViewport" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "toast",
              t.type === "error" ? "toastError" : "",
              t.type === "success" ? "toastSuccess" : "",
              t.type === "info" ? "toastInfo" : "",
            ].join(" ")}
            role="status"
          >
            <div className="toastTitle">
              <span>{t.title || (t.type === "error" ? "Error" : t.type === "success" ? "Success" : "Notice")}</span>
              <button className="toastBtn" onClick={() => api.removeToast(t.id)} aria-label="Dismiss notification">
                ✕
              </button>
            </div>
            {t.message ? <div className="toastMsg">{t.message}</div> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// PUBLIC_INTERFACE
export function useToasts() {
  /** Hook to access toast API. */
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within ToastProvider");
  return ctx;
}
