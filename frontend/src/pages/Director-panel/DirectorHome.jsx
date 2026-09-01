import "@vidstack/react/player/styles/base.css";
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { getRequest } from "../../api/client";

import DirectorNav from "../../components/DirectorNav.jsx";

function formatDuration(sec) {  const s = Math.round(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const rem = String(ss).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${rem}` : `${mm}:${rem}`;
}

function StatusBadge({ status }) {
  const styles = {
    approved: "border-[var(--gold)] text-[var(--gold-soft)] bg-[rgba(217,166,83,0.08)]",
    pending: "border-[rgba(239,231,218,0.2)] text-[var(--mauve)] bg-transparent",
    rejected: "border-[var(--error)] text-[var(--error)] bg-[rgba(224,138,107,0.08)]",
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

function VideoCard({ video }) {
  return (
    <div className="overflow-hidden rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#17131a]">
      <NavLink
        to={`/director/videos/${video.id}/watch`}
        className="group relative block aspect-video bg-[var(--velvet-deep)]"
      >
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--mauve)]">
            <span className="font-[var(--font-mono)] text-xs">No thumbnail</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.35)] opacity-0 transition-opacity group-hover:opacity-100">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="var(--gold-soft)">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="absolute bottom-1.5 right-1.5 rounded bg-[rgba(0,0,0,0.75)] px-1.5 py-0.5 font-[var(--font-mono)] text-[0.65rem] text-[var(--parchment)]">
          {formatDuration(video.durationSec)}
        </span>
      </NavLink>

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-[var(--font-display)] text-base font-medium text-[var(--parchment)]">
            {video.title}
          </h3>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={video.moderationStatus} />
          <span className="font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.08em] text-[var(--mauve)]">
            {video.visibility}
          </span>
          <span className="font-[var(--font-mono)] text-[0.65rem] text-[var(--mauve)]">
            {video.views ?? 0} views
          </span>
        </div>

      </div>
    </div>
  );
}

export default function DirectorHome() {
  const { auth } = useAuth();
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getRequest("/directors/videos")
      .then((data) => {
        if (!cancelled) setVideos(data.videos || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load videos");
      });
    return () => {
      cancelled = true;
    };
  }, [auth.token]);

  return (
    <div className="min-h-screen bg-[var(--stage)] text-[var(--parchment)]">
      <DirectorNav />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <span className="mb-2 inline-block font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.16em] text-[var(--gold)]">
              Director
            </span>
            <h1 className="font-[var(--font-display)] text-3xl font-medium text-[var(--parchment)]">
              Your Films
            </h1>
          </div>
        </div>

        {error && (
          <div className="rounded-[3px] border border-[rgba(224,138,107,0.4)] bg-[rgba(224,138,107,0.12)] px-4 py-3 text-sm text-[var(--error)]">
            {error}
          </div>
        )}

        {!error && videos === null && (
          <p className="font-[var(--font-mono)] text-sm text-[var(--mauve)]">Loading…</p>
        )}

        {!error && videos !== null && videos.length === 0 && (
          <div className="rounded-[3px] border border-dashed border-[rgba(239,231,218,0.2)] py-16 text-center">
            <p className="mb-4 text-[var(--mauve)]">You haven't uploaded any films yet.</p>
            <NavLink
              to="/director/upload"
              className="inline-block rounded-[3px] bg-[var(--gold)] px-4 py-2 font-[var(--font-body)] text-sm font-semibold text-[#1a1210] transition-colors hover:bg-[var(--gold-soft)]"
            >
              Upload your first film
            </NavLink>
          </div>
        )}

        {videos && videos.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}