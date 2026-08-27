import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Plyr from "plyr";
import Hls from "hls.js";
import "plyr/dist/plyr.css";
import { getRequest } from "../../api/client";

function StatusBadge({ status }) {
  const styles = {
    approved:
      "border-[var(--gold)] text-[var(--gold-soft)] bg-[rgba(217,166,83,0.08)]",
    pending:
      "border-[rgba(239,231,218,0.2)] text-[var(--mauve)] bg-transparent",
    rejected:
      "border-[var(--error)] text-[var(--error)] bg-[rgba(224,138,107,0.08)]",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.08em] ${
        styles[status] || styles.pending
      }`}
    >
      {status || "pending"}
    </span>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
    </svg>
  );
}

export default function WatchVideo() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [video, setVideo] = useState(null);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const plyrRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getRequest(`/directors/videos/${id}`)
      .then((data) => {
        if (!cancelled) setVideo(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load video");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!video?.hlsManifestUrl || !videoRef.current) return;
    const src = video.hlsManifestUrl;
    const el = videoRef.current;
    let hls;
    let player;

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
      settings: ["quality", "speed"],
    };

    function buildPlyr(qualityConfig) {
      player = new Plyr(el, qualityConfig ? { ...plyrOptions, quality: qualityConfig } : plyrOptions);
      plyrRef.current = player;
    }

    if (Hls.isSupported()) {
      hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(el);

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) setError("Playback error — the stream failed to load.");
      });

      // wait for hls.js to know the manifest's rendition list before
      // building Plyr — this is what makes the quality menu real instead
      // of just decorative
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const heights = [...new Set(hls.levels.map((l) => l.height))].sort((a, b) => b - a);
        const options = [0, ...heights]; // 0 = "Auto", then highest quality first

        buildPlyr({
          default: 0,
          options,
          forced: true,
          onChange: (newHeight) => {
            if (newHeight === 0) {
              hls.currentLevel = -1; // hand control back to hls.js's ABR
            } else {
              const levelIndex = hls.levels.findIndex((l) => l.height === newHeight);
              if (levelIndex !== -1) hls.currentLevel = levelIndex;
            }
          },
        });
      });
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari's native HLS handles ABR itself — no hls.js levels to
      // expose, so no manual quality switcher here, same as before
      el.src = src;
      buildPlyr(null);
    } else {
      setError("This browser doesn't support HLS playback.");
      return;
    }

    return () => {
      player?.destroy();
      plyrRef.current = null;
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
  }, [video?.hlsManifestUrl]);

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--stage)] px-6 py-12 text-[var(--parchment)]">
        <button
          onClick={() => navigate("/director")}
          className="mb-6 flex items-center gap-2 font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.08em] text-[var(--mauve)] hover:text-[var(--parchment)]"
        >
          <BackIcon /> Back to My Films
        </button>
        <div className="rounded-[3px] border border-[rgba(224,138,107,0.4)] bg-[rgba(224,138,107,0.12)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-[var(--stage)] px-6 py-12 text-[var(--parchment)]">
        <p className="font-[var(--font-mono)] text-sm text-[var(--mauve)]">
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--stage)] text-[var(--parchment)]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <button
          onClick={() => navigate("/director")}
          className="mb-6 flex items-center gap-2 font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.08em] text-[var(--mauve)] hover:text-[var(--parchment)]"
        >
          <BackIcon /> Back to My Films
        </button>

        <div className="overflow-hidden rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-black">
          <video ref={videoRef} title={video.title} playsInline />
        </div>

        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="font-[var(--font-display)] text-2xl font-medium text-[var(--parchment)]">
              {video.title}
            </h1>
            <StatusBadge status={video.moderationStatus} />
          </div>

          <div className="mb-4 flex flex-wrap gap-3 font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.06em] text-[var(--mauve)]">
            <span>{video.visibility}</span>
            <span>{video.views ?? 0} views</span>
            {video.releaseYear && <span>{video.releaseYear}</span>}
            {video.language && <span>{video.language}</span>}
          </div>

          {video.description && (
            <p className="mb-4 max-w-2xl text-sm leading-relaxed text-[var(--parchment)]">
              {video.description}
            </p>
          )}

          {video.genres?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {video.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-[rgba(239,231,218,0.2)] px-2.5 py-0.5 text-[0.75rem] text-[var(--mauve)]"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
