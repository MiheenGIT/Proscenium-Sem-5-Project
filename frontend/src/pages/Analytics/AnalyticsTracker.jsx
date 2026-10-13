import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { postJson } from "../../api/client.js";
import { analyticsDisabled } from "./trackEvent.js";

function safeStorage(key, create) {
  try {
    let value = localStorage.getItem(key);
    if (!value) {
      value = create();
      localStorage.setItem(key, value);
    }
    return value;
  } catch {
    return create();
  }
}

function makeId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    /* use fallback */
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function clean(value, max = 120) {
  return (
    String(value || "")
      .trim()
      .replace(/[<>\r\n]/g, "")
      .slice(0, max) || undefined
  );
}

/** Destination path only. Link text is never sent: it can contain names or emails. */
function linkLabel(el) {
  try {
    const url = new URL(el.getAttribute("href") || "", window.location.origin);
    return url.origin === window.location.origin
      ? url.pathname
      : `external:${url.hostname}`;
  } catch {
    return undefined;
  }
}

/** Tracks anonymous page/session activity and basic player/search events. Never records form values outside search controls. */
export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    if (analyticsDisabled(location.pathname)) return undefined;
    const pageEnteredAt = Date.now();
    const visitorId = safeStorage("proscenium_visitor_id", makeId);
    let sessionId;
    try {
      sessionId = sessionStorage.getItem("proscenium_session_id");
      if (!sessionId) {
        sessionId = makeId();
        sessionStorage.setItem("proscenium_session_id", sessionId);
      }
    } catch {
      sessionId = makeId();
    }

    const params = new URLSearchParams(window.location.search);
    const source = (() => {
      try {
        return document.referrer
          ? new URL(document.referrer).hostname
          : "direct";
      } catch {
        return "direct";
      }
    })();
    const attribution = {
      visitorId,
      sessionId,
      path: location.pathname,
      source: clean(source),
      utmSource: clean(params.get("utm_source")),
      utmMedium: clean(params.get("utm_medium")),
      utmCampaign: clean(params.get("utm_campaign"), 160),
    };

    try {
      if (!sessionStorage.getItem("proscenium_session_started")) {
        sessionStorage.setItem("proscenium_session_started", "1");
        void postJson("/analytics/events", {
          ...attribution,
          eventType: "session_start",
        }).catch(() => {});
      }
      // React StrictMode can replay effects; suppress duplicate page views for the same path in a short window.
      const stampKey = `proscenium_page_view:${location.pathname}`;
      const previous = Number(sessionStorage.getItem(stampKey) || 0);
      const now = Date.now();
      if (now - previous > 900) {
        sessionStorage.setItem(stampKey, String(now));
        void postJson("/analytics/events", {
          ...attribution,
          eventType: "page_view",
        }).catch(() => {});
      }
    } catch {
      void postJson("/analytics/events", {
        ...attribution,
        eventType: "page_view",
      }).catch(() => {});
    }
    return () => {
      const durationMs = Math.min(3600000, Date.now() - pageEnteredAt);
      // Ignore the immediate React StrictMode effect replay.
      if (durationMs >= 500)
        void postJson("/analytics/events", {
          ...attribution,
          eventType: "page_exit",
          durationMs,
        }).catch(() => {});
    };
  }, [location.pathname]);

  useEffect(() => {
    if (analyticsDisabled(location.pathname)) return undefined;
    const onClick = (event) => {
      const target = event.target?.closest?.("a, button[data-analytics-label]");
      if (!target) return;
      const label = clean(
        target.dataset?.analyticsLabel ||
          target.getAttribute("aria-label") ||
          linkLabel(target),
        100,
      );
      if (!label) return;
      const visitorId = safeStorage("proscenium_visitor_id", makeId);
      let sessionId;
      try {
        sessionId = sessionStorage.getItem("proscenium_session_id") || makeId();
      } catch {
        sessionId = makeId();
      }
      void postJson("/analytics/events", {
        eventType: "navigation_click",
        visitorId,
        sessionId,
        path: location.pathname,
        label,
      }).catch(() => {});
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [location.pathname]);

  useEffect(() => {
    // Staff previews (admin/director) would inflate audience playback and retention numbers.
    if (analyticsDisabled(location.pathname)) return undefined;
    const videoIdFromPath = () => {
      const match = location.pathname.match(
        /\/(?:videos|watch)\/([^/]+)(?:\/|$)/i,
      );
      return match?.[1] || undefined;
    };
    const send = (eventType, extra = {}) => {
      const visitorId = safeStorage("proscenium_visitor_id", makeId);
      let sessionId;
      try {
        sessionId = sessionStorage.getItem("proscenium_session_id") || makeId();
      } catch {
        sessionId = makeId();
      }
      void postJson("/analytics/events", {
        eventType,
        visitorId,
        sessionId,
        path: location.pathname,
        videoId: videoIdFromPath(),
        ...extra,
      }).catch(() => {});
    };
    const onPlay = (event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      if (!video.dataset.prosceniumAnalyticsStarted) {
        video.dataset.prosceniumAnalyticsStarted = "1";
        send("playback_start", {
          durationMs: Number.isFinite(video.duration)
            ? Math.round(video.duration * 1000)
            : undefined,
        });
      }
    };
    const onTimeUpdate = (event) => {
      const video = event.target;
      if (
        !(video instanceof HTMLVideoElement) ||
        !Number.isFinite(video.duration) ||
        video.duration <= 0
      )
        return;
      const now = Date.now();
      const last = Number(video.dataset.prosceniumLastProgressAt || 0);
      if (now - last < 15000) return;
      video.dataset.prosceniumLastProgressAt = String(now);
      send("playback_progress", {
        progressPercent: Math.min(
          100,
          Math.round((video.currentTime / video.duration) * 1000) / 10,
        ),
      });
    };
    const onEnded = (event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      send("playback_complete", {
        progressPercent: 100,
        durationMs: Number.isFinite(video.duration)
          ? Math.round(video.duration * 1000)
          : undefined,
      });
    };
    const onWaiting = (event) => {
      if (event.target instanceof HTMLVideoElement) send("playback_buffer");
    };
    const onError = (event) => {
      if (event.target instanceof HTMLVideoElement)
        send("playback_error", {
          errorCode: String(event.target.error?.code || "media_error"),
        });
    };
    document.addEventListener("play", onPlay, true);
    document.addEventListener("ended", onEnded, true);
    document.addEventListener("timeupdate", onTimeUpdate, true);
    document.addEventListener("waiting", onWaiting, true);
    document.addEventListener("error", onError, true);
    return () => {
      document.removeEventListener("play", onPlay, true);
      document.removeEventListener("ended", onEnded, true);
      document.removeEventListener("timeupdate", onTimeUpdate, true);
      document.removeEventListener("waiting", onWaiting, true);
      document.removeEventListener("error", onError, true);
    };
  }, [location.pathname]);

  return null;
}
