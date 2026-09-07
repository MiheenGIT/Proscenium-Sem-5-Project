import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { AlertCircle, LoaderCircle } from "lucide-react";

export default function AdminVideoPlayer({ src, poster, title }) {
  const videoRef = useRef(null);
  const plyrRef = useRef(null);
  const hlsRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = videoRef.current;

    if (!el || !src) {
      setLoading(false);
      setError("No video stream is available.");
      return undefined;
    }

    setLoading(true);
    setError("");

    let hls = null;
    let player = null;
    let isMounted = true;

    // Helper to safely tear down previous instances
    function cleanup() {
      if (plyrRef.current) {
        try {
          plyrRef.current.destroy();
        } catch (_) {}
        plyrRef.current = null;
      }
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (_) {}
        hlsRef.current = null;
      }
    }

    cleanup();

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hlsRef.current = hls;

      hls.attachMedia(el);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (!isMounted) return;
        hls.loadSource(src);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!isMounted) return;

        // Extract available resolution heights (e.g., [360, 720, 1080])
        const qualities = hls.levels
          .map((level) => level.height)
          .filter(Boolean)
          .sort((a, b) => a - b);

        const plyrOptions = {
          controls: [
            "play-large",
            "play",
            "progress",
            "current-time",
            "mute",
            "volume",
            "settings",
            "fullscreen",
          ],
          settings: qualities.length > 0 ? ["quality", "speed"] : ["speed"],
          quality:
            qualities.length > 0
              ? {
                  default: qualities[qualities.length - 1],
                  options: qualities,
                  forced: true,
                  onChange: (quality) => {
                    const levelIndex = hls.levels.findIndex(
                      (level) => level.height === quality,
                    );
                    if (levelIndex !== -1) {
                      hls.currentLevel = levelIndex;
                    }
                  },
                }
              : undefined,
        };

        player = new Plyr(el, plyrOptions);
        plyrRef.current = player;
        setLoading(false);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!isMounted) return;
        if (data?.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setLoading(false);
              setError("Stream failed to load.");
              break;
          }
        }
      });
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Apple HLS (Safari)
      el.src = src;

      player = new Plyr(el, {
        controls: [
          "play-large",
          "play",
          "progress",
          "current-time",
          "mute",
          "volume",
          "settings",
          "fullscreen",
        ],
        settings: ["speed"],
      });

      plyrRef.current = player;
      setLoading(false);
    } else {
      setLoading(false);
      setError("This browser does not support HLS playback.");
    }

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [src]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl [--plyr-color-main:#d9a653] [--plyr-video-control-color:#efe7da] [--plyr-video-control-color-hover:#100d10] [--plyr-video-control-background-hover:#d9a653] [--plyr-menu-background:#171216] [--plyr-menu-color:#efe7da] [--plyr-menu-border-color:rgba(255,255,255,0.08)] [--plyr-menu-radius:12px] [--plyr-menu-shadow:0_15px_35px_rgba(0,0,0,0.85)]">
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        poster={poster || undefined}
        className="aspect-video w-full bg-black"
        aria-label={title || "Video player"}
      />

      {loading && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-xs text-[#d9d0d2]">
            <LoaderCircle size={16} className="animate-spin text-[#d9a653]" />
            <span>Loading stream & qualities…</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/85 p-6 text-center">
          <div className="max-w-xs">
            <AlertCircle size={28} className="mx-auto text-[#e08a6b]" />
            <p className="mt-2 text-xs font-medium text-[#e08a6b]">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}