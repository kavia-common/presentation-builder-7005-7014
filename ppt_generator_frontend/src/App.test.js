import React from "react";
import { act } from "react-dom/test-utils";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";

test("renders app without crashing", () => {
  const div = document.createElement("div");
  document.body.appendChild(div);

  const root = ReactDOM.createRoot(div);

  act(() => {
    root.render(
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    );
  });

  // Basic sanity: the shell should render a main workspace element.
  const main = div.querySelector('main[aria-label="Workspace"]');
  expect(main).toBeTruthy();

  act(() => {
    root.unmount();
  });

  div.remove();
});
