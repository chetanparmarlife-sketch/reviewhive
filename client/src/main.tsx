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
  const normalized = raw.replace(/^\/+/, "").replace(/^\?+/, "");
  return (
    normalized.startsWith("access_token=") ||
    normalized.startsWith("refresh_token=") ||
    normalized.startsWith("error=") ||
    normalized.startsWith("type=") ||
    normalized.includes("error_code=") ||
    normalized.includes("sb=")
  );
}

if (isSupabaseAuthHash(window.location.hash)) {
  const hashRaw = window.location.hash.slice(1).replace(/^\/+/, "").replace(/^\?+/, "");
  const hashParams = new URLSearchParams(hashRaw);
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
