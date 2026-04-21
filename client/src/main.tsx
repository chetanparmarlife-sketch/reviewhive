// Install in-memory shims for browser storage APIs BEFORE any library that
// might probe them. The iframe preview sandbox blocks window.localStorage/
// sessionStorage/indexedDB entirely; supabase-js probes these defensively.
// The shims ensure every library call either no-ops or uses an in-memory map.
import "./lib/install-storage-shims";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function isSupabaseAuthHash(hash: string): boolean {
  if (!hash || hash === "#") return false;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return (
    raw.startsWith("access_token=") ||
    raw.startsWith("refresh_token=") ||
    raw.startsWith("error=") ||
    raw.startsWith("type=")
  );
}

if (isSupabaseAuthHash(window.location.hash)) {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const queryParams = new URLSearchParams(window.location.search);
  const err = hashParams.get("error_description") ?? hashParams.get("error");
  if (err) queryParams.set("auth_error", err);
  const search = queryParams.toString();
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${search ? `?${search}` : ""}#/login`,
  );
}

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
