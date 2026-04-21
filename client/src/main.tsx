// Install in-memory shims for browser storage APIs BEFORE any library that
// might probe them. The iframe preview sandbox blocks window.localStorage/
// sessionStorage/indexedDB entirely; supabase-js probes these defensively.
// The shims ensure every library call either no-ops or uses an in-memory map.
import "./lib/install-storage-shims";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
