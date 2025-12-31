import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Generate from "../views/Generate";
import Templates from "../views/Templates";
import Settings from "../views/Settings";

// PUBLIC_INTERFACE
export default function AppRoutes() {
  /** Defines app routes for SPA navigation. */
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/generate" replace />} />
      <Route path="/generate" element={<Generate />} />
      <Route path="/templates" element={<Templates />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/generate" replace />} />
    </Routes>
  );
}
