import { postJson } from "../../api/client.js";

function makeId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* use fallback */ }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function read(store, key) {
  try {
    let value = store.getItem(key);
    if (!value) { value = makeId(); store.setItem(key, value); }
    return value;
  } catch {
    return makeId();
  }
}

/**
 * True when nothing should be recorded: staff pages (admin and director), browsers sending Do Not Track,
 * or a visitor who opted out (localStorage "proscenium_analytics_optout" = "1").
 */
export function analyticsDisabled(path = window.location.pathname) {
  if (path.startsWith("/admin") || path.startsWith("/director")) return true;
  try {
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return true;
    return localStorage.getItem("proscenium_analytics_optout") === "1";
  } catch {
    return false;
  }
}

/** Fire-and-forget analytics event; uses the same anonymous visitor/session ids as AnalyticsTracker. */
export function trackEvent(eventType, extra = {}) {
  if (analyticsDisabled()) return;
  void postJson("/analytics/events", {
    eventType,
    visitorId: read(localStorage, "proscenium_visitor_id"),
    sessionId: read(sessionStorage, "proscenium_session_id"),
    path: window.location.pathname,
    ...extra,
  }).catch(() => { });
}
