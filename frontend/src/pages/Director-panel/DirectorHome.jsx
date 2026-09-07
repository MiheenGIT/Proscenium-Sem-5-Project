import "@vidstack/react/player/styles/base.css";
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { getRequest } from "../../api/client";
import DirectorNav from "../../components/DirectorNav.jsx";
import { Film, Play, Eye, Plus } from "lucide-react";

function formatDuration(sec) {
  const s = Math.round(sec || 0);
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.08em] ${
        styles[status] || styles.pending
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "approved"
            ? "bg-[#7fc59b]"
            : status === "rejected"
              ? "bg-[#e08a6b]"
              : "bg-[#d9a653]"
        } animate-pulse`}
      />
      {status || "pending"}
    </span>
  );
}

function VideoCard({ video }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition duration-200 hover:border-[#d9a653]/40 hover:bg-white/[0.035]">
      {/* Thumbnail Stage with HUD brackets */}
      <NavLink
        to={`/director/videos/${video.id}/watch`}
        className="relative block aspect-video w-full bg-[#0d0a0d] overflow-hidden"
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02] group-hover:brightness-105"
          />
        ) : null}

        <Film size={28} className="absolute inset-0 m-auto text-white/10 pointer-events-none" />

        {/* HUD corner brackets */}
        <span className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 border-l border-t border-[#d9a653]/60" />
        <span className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 border-r border-t border-[#d9a653]/60" />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 h-3.5 w-3.5 border-b border-l border-[#d9a653]/60" />
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 h-3.5 w-3.5 border-b border-r border-[#d9a653]/60" />

        {/* Play Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 backdrop-blur-[1px]">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/80 border border-[#d9a653]/40 text-[#d9a653] shadow-lg">
            <Play size={16} fill="currentColor" />
          </span>
        </div>

        {/* Duration badge */}
        {video.durationSec ? (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/80 border border-white/10 px-2 py-0.5 font-[var(--font-mono)] text-[0.62rem] text-[var(--parchment)] backdrop-blur">
            {formatDuration(video.durationSec)}
          </span>
        ) : null}
      </NavLink>

      {/* Card Info */}
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-[var(--font-display)] text-base font-medium text-[var(--parchment)] group-hover:text-[var(--gold-soft)] transition">
            {video.title || "Untitled Film"}
          </h3>
          <StatusBadge status={video.moderationStatus} />
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 font-[var(--font-mono)] text-[0.65rem] uppercase tracking-wider text-[var(--mauve)]">
          <span>{video.visibility || "Standard"}</span>
          <span className="flex items-center gap-1.5">
            <Eye size={12} className="text-[#71656a]" />
            {video.views ?? 0} views
          </span>
        </div>
      </div>
    </article>
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

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.2em] text-[var(--gold)]">
              Director Portfolio
            </span>
            <h1 className="mt-1 font-[var(--font-display)] text-3xl font-medium text-[var(--parchment)] sm:text-4xl">
              Your Films
            </h1>
            <p className="mt-1 text-sm text-[var(--mauve)]">
              Manage film distribution, screening status, and cast metadata.
            </p>
          </div>

          <NavLink
            to="/director/upload"
            className="inline-flex items-center gap-4 rounded-xl px-4 py-2.5 font-[var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[#1a151a] border border-gold-900 transition shadow-sm shadow-[#d9a653]/13"
          >
            <Plus size={15} /> Upload Film
          </NavLink>
        </div>

        {error && (
          <div className="rounded-xl border border-[rgba(224,138,107,0.4)] bg-[rgba(224,138,107,0.12)] px-4 py-3 text-sm text-[var(--error)]">
            {error}
          </div>
        )}

        {!error && videos === null && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.02]" />
            ))}
          </div>
        )}

        {!error && videos !== null && videos.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[rgba(239,231,218,0.18)] bg-white/[0.015] py-20 text-center">
            <Film size={36} className="mx-auto text-[var(--mauve)]/50" />
            <h3 className="mt-4 font-[var(--font-display)] text-xl text-[var(--parchment)]">
              No films submitted yet
            </h3>
            <p className="mt-1 text-sm text-[var(--mauve)]">
              Upload your first film to initiate the QA and screening pipeline.
            </p>
            <NavLink
              to="/director/upload"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#100d10] transition hover:brightness-110 shadow-md shadow-[#d9a653]/20"
            >
              <Plus size={14} /> Upload your first film
            </NavLink>
          </div>
        )}

        {videos && videos.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}