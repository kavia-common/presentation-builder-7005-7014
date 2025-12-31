import React from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import AppRoutes from "./routes/AppRoutes";

// PUBLIC_INTERFACE
function App() {
  /** Application shell: sidebar + main content area with route-driven views. */
  return (
    <div className="appRoot">
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
