import React, { useEffect } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import AppRoutes from "./routes/AppRoutes";
import { useToasts } from "./context/ToastContext";
import { setApiClientToastAdapter } from "./api/client";

function ApiClientToastBridge() {
  const toasts = useToasts();

  useEffect(() => {
    setApiClientToastAdapter({
      info: (title, message) => toasts.info(title, message),
      error: (title, message) => toasts.error(title, message),
    });

    return () => setApiClientToastAdapter(null);
  }, [toasts]);

  return null;
}

// PUBLIC_INTERFACE
function App() {
  /** Application shell: sidebar + main content area with route-driven views. */
  return (
    <div className="appRoot">
      <ApiClientToastBridge />
      <div className="shell">
        <Sidebar />
        <main className="main" aria-label="Workspace">
          <AppRoutes />
        </main>
      </div>
    </div>
  );
}

export default App;

