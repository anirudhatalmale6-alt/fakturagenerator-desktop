import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";
import { InvoicePage } from "./InvoicePage";
import { AppErrorBoundary } from "./AppErrorBoundary";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <AppErrorBoundary>
      <InvoicePage />
    </AppErrorBoundary>
  </StrictMode>,
);
