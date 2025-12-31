import React from "react";
import { NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

function NavIcon({ children }) {
  return <div className="navIcon" aria-hidden="true">{children}</div>;
}

// PUBLIC_INTERFACE
export default function Sidebar() {
  /** Left navigation with branding and primary routes. */
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="sidebarCard">
        <div className="brandRow">
          <div className="brandMark" aria-hidden="true">P</div>
          <div className="brandTitle">
            <strong>PPT Generator</strong>
            <span>Corporate Navy</span>
          </div>
        </div>

        <nav className="nav" aria-label="Navigation">
          <NavLink
            to="/generate"
            className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}
          >
            <NavIcon>⚡</NavIcon>
            Generate
          </NavLink>

          <NavLink
            to="/templates"
            className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}
          >
            <NavIcon>▦</NavIcon>
            Templates
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}
          >
            <NavIcon>⚙</NavIcon>
            Settings
          </NavLink>
        </nav>

        <div className="sidebarFooter">
          <span className="chip">Theme: <strong>{theme}</strong></span>
          <button className="btn btnSecondary" onClick={toggleTheme} aria-label="Toggle app theme">
            Toggle
          </button>
        </div>
      </div>
    </aside>
  );
}
