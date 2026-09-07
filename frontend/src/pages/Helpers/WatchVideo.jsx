import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, NavLink } from "react-router-dom";
import Plyr from "plyr";
import Hls from "hls.js";
import "plyr/dist/plyr.css";
import { getRequest, deleteRequest, postEmpty } from "../../api/client";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

/* -------------------------------------------------------------------------- */
/*                                    ICONS                                   */
/* -------------------------------------------------------------------------- */

function ArrowLeftIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
      />
    </svg>
  );
}

function EditIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  );
}

function TrashIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

function FilmReelIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zM8 17H5v-4h3v4zm5 0h-3v-4h3v4zm5 0h-3v-4h3v4z" />
    </svg>
  );
}

function RefreshIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function WarningIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                              HELPER FORMATTERS                             */
/* -------------------------------------------------------------------------- */

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function formatFileSize(bytes) {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

function formatDuration(sec) {
  if (!sec) return null;
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const rem = String(ss).padStart(2, "0");
  return h ? `${h}h ${m}m ${rem}s` : `${mm}:${rem}`;
}

/* -------------------------------------------------------------------------- */
/*                               STATUS BADGE                                 */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }) {
  const configs = {
    approved: {
      dot: "bg-[#7ad399]",
      wrap: "border-[#7ad399]/30 text-[#9ee2b7] bg-[#7ad399]/10",
      label: "Approved & Live",
    },
    pending: {
      dot: "bg-[var(--gold)] animate-pulse",
      wrap: "border-[var(--gold)]/30 text-[var(--gold-soft)] bg-[var(--gold)]/10",
      label: "Under Review",
    },
    rejected: {
      dot: "bg-[var(--error)]",
      wrap: "border-[var(--error)]/30 text-[var(--error)] bg-[var(--error)]/10",
      label: "Revision Required",
    },
  };

  const current = configs[status] || configs.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.14em] ${current.wrap}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

export default function WatchVideo() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [video, setVideo] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showModerationNotice, setShowModerationNotice] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState(null);

  const videoRef = useRef(null);
  const plyrRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getRequest(`/directors/videos/${id}`)
      .then((data) => {
        if (!cancelled) {
          setVideo(data);
          if (data.moderationStatus === "rejected") {
            setShowModerationNotice(true);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load video archive");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    setConfirmingDelete(false);
    setDeleting(true);
    try {
      await deleteRequest(`/directors/videos/${id}`);
      navigate("/director");
    } catch (err) {
      setDeleteError(err.message || "Delete failed");
      setDeleting(false);
    }
  }

  async function handleResubmit() {
    setResubmitError(null);
    setResubmitting(true);
    try {
      await postEmpty(`/directors/videos/${id}/resubmit`);
      setVideo((prev) => ({
        ...prev,
        moderationStatus: "pending",
        moderationComment: null,
      }));
    } catch (err) {
      setResubmitError(err.message || "Resubmission failed");
    } finally {
      setResubmitting(false);
    }
  }

  useEffect(() => {
    if (!video?.hlsManifestUrl || !videoRef.current) return;

    const src = video.hlsManifestUrl;
    const el = videoRef.current;

    let hls = null;
    let player = null;

    if (Hls.isSupported()) {
      hls = new Hls();
      hlsRef.current = hls;
      hls.attachMedia(el);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(src);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const qualities = hls.levels
          .map((level) => level.height)
          .filter((height) => height)
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
          settings: ["quality", "speed"],
          quality: {
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
          },
        };

        player = new Plyr(el, plyrOptions);
        plyrRef.current = player;
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError("Playback error — Master HLS stream unavailable.");
        }
      });
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
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
    } else {
      setError("This environment does not support HLS stream playback.");
    }

    return () => {
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
      if (player) {
        player.destroy();
        plyrRef.current = null;
      }
    };
  }, [video?.hlsManifestUrl]);

  /* -------------------------------- Error State ------------------------------- */
  if (error) {
    return (
      <div className="min-h-screen bg-[var(--stage,#0e0b10)] px-6 py-12 text-[var(--parchment,#eae1d0)] selection:bg-[var(--gold)]/20">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={() => navigate("/director")}
            className="group mb-8 inline-flex items-center gap-2 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.14em] text-[var(--mauve,#9d919f)] transition-colors hover:text-[var(--parchment,#eae1d0)]"
          >
            <ArrowLeftIcon className="transition-transform group-hover:-translate-x-0.5" />
            <span>Return to Catalog</span>
          </button>
          <div className="rounded border border-[var(--error,#df7861)]/30 bg-[var(--error,#df7861)]/10 p-5 text-sm text-[var(--error,#df7861)] backdrop-blur-sm">
            <div className="mb-1 flex items-center gap-2 font-[var(--font-mono)] text-[0.7rem] uppercase tracking-wider font-semibold">
              <WarningIcon /> Playback Vault Error
            </div>
            <p className="text-xs opacity-90">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------- Loading State ------------------------------ */
  if (!video) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--stage,#0e0b10)] text-[var(--parchment,#eae1d0)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border border-[var(--gold,#d9a653)] border-t-transparent" />
          <p className="font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.2em] text-[var(--mauve,#9d919f)]">
            Loading Archive Reel…
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------- Loaded State ------------------------------- */
  return (
    <div className="min-h-screen bg-[var(--stage,#0e0b10)] text-[var(--parchment,#eae1d0)] selection:bg-[var(--gold)]/20 pb-20">
      {/* Top Screening Bar / Breadcrumb */}
      <header className="border-b border-white/[0.06] bg-[#120e15]/60 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
          <button
            onClick={() => navigate("/director")}
            className="group inline-flex items-center gap-1.5 font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.16em] text-[var(--mauve,#9d919f)] opacity-80 transition-all hover:opacity-100 hover:text-[var(--parchment,#eae1d0)]"
          >
            <ArrowLeftIcon className="w-3 h-3 transition-transform duration-150 group-hover:-translate-x-0.5" />
            <span>Catalog</span>
          </button>

          <div className="flex items-center gap-2.5 font-[var(--font-mono)] text-[0.6rem] tracking-[0.12em] text-[var(--mauve,#9d919f)]">
            <span className="hidden sm:inline-block opacity-40">
              #
              {String(video.id || id)
                .slice(-6)
                .toUpperCase()}
            </span>
            <span className="opacity-20">•</span>
            <StatusBadge status={video.moderationStatus} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-6">
        {/* Video Screening Frame */}
        <div className="relative overflow-hidden rounded-md border border-white/[0.08] bg-black shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
          {/* Subtle Ambient Vignette / Film Slate Accent */}
          <div className="pointer-events-none absolute inset-0 z-10 rounded-md border border-white/[0.04]" />
          <video
            ref={videoRef}
            title={video.title}
            playsInline
            className="aspect-video w-full object-contain"
          />
        </div>

        {/* Rejected State Warning Strip */}
        {video.moderationStatus === "rejected" && (
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded border border-[var(--error,#df7861)]/30 bg-[#1e1214] p-4 text-xs">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-[var(--error,#df7861)]">
                <WarningIcon className="w-4 h-4" />
              </span>
              <div>
                <p className="font-[var(--font-mono)] text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--error,#df7861)]">
                  Film Requires Revision
                </p>
                <p className="mt-0.5 text-[var(--parchment,#eae1d0)]/90 leading-relaxed">
                  {video.moderationComment ||
                    "Reviewer suggested changes before publication."}
                </p>
              </div>
            </div>

            <button
              onClick={handleResubmit}
              disabled={resubmitting}
              className="inline-flex shrink-0 items-center gap-1.5 rounded border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-3.5 py-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-wider text-[var(--gold-soft,#e5be79)] transition hover:bg-[var(--gold)] hover:text-black disabled:opacity-50"
            >
              <RefreshIcon
                className={`w-3 h-3 ${resubmitting ? "animate-spin" : ""}`}
              />
              {resubmitting ? "Submitting…" : "Resubmit Reel"}
            </button>
          </div>
        )}

        {/* Primary Meta & Control Deck */}
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* Main Info Column (2 cols wide) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header / Title / Quick Actions */}
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h1 className="font-[var(--font-display,serif)] text-3xl sm:text-4xl font-normal tracking-tight text-[var(--parchment,#eae1d0)]">
                  {video.title}
                </h1>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-2">
                  <NavLink
                    to={`/director/videos/${video.id}/edit`}
                    className="inline-flex items-center gap-1.5 rounded border border-white/[0.14] bg-white/[0.03] px-3.5 py-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.08em] text-[var(--parchment,#eae1d0)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold-soft)]"
                  >
                    <EditIcon /> Edit Meta
                  </NavLink>
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 rounded border border-[var(--error)]/30 bg-transparent px-3.5 py-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.08em] text-[var(--error)] transition-colors hover:bg-[var(--error)]/10 disabled:opacity-50"
                  >
                    <TrashIcon /> {deleting ? "…" : "Decommission"}
                  </button>
                </div>
              </div>

              {/* Film Spec Ledger Strip */}
              <div className="mt-3 flex flex-wrap items-center gap-y-2 gap-x-3.5 font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.08em] text-[var(--mauve,#9d919f)]">
                {video.releaseYear && (
                  <span className="text-[var(--parchment)]">
                    {video.releaseYear}
                  </span>
                )}
                {video.durationSec && (
                  <>
                    <span className="opacity-30">•</span>
                    <span>{formatDuration(video.durationSec)}</span>
                  </>
                )}
                {video.productionCountry && (
                  <>
                    <span className="opacity-30">•</span>
                    <span>{video.productionCountry}</span>
                  </>
                )}
                {video.language && (
                  <>
                    <span className="opacity-30">•</span>
                    <span>{video.language}</span>
                  </>
                )}
                <span className="opacity-30">•</span>
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[0.62rem] text-[var(--gold-soft)]">
                  {video.visibility || "Private"}
                </span>
                <span className="opacity-30">•</span>
                <span>{video.views ?? 0} Views</span>
              </div>
            </div>

            {/* Synopsis / Description */}
            {video.description && (
              <div className="space-y-2 border-t border-white/[0.06] pt-6">
                <h3 className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.16em] text-[var(--gold,#d9a653)]">
                  Synopsis
                </h3>
                <p className="max-w-2xl text-[0.92rem] leading-relaxed text-[var(--parchment,#eae1d0)]/90 font-light">
                  {video.description}
                </p>
              </div>
            )}

            {/* Genres & Curated Tags */}
            {(video.genres?.length > 0 || video.tags?.length > 0) && (
              <div className="space-y-4 border-t border-white/[0.06] pt-6">
                {video.genres?.length > 0 && (
                  <div>
                    <h3 className="mb-2.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.16em] text-[var(--mauve,#9d919f)]">
                      Categorization
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {video.genres.map((genre) => (
                        <span
                          key={genre}
                          className="rounded border border-white/[0.12] bg-white/[0.02] px-3 py-1 font-[var(--font-mono)] text-[0.7rem] uppercase tracking-wider text-[var(--parchment)]"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {video.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {video.tags.map((tag) => (
                      <span
                        key={tag}
                        className="font-[var(--font-mono)] text-[0.68rem] text-[var(--mauve,#9d919f)]/80 hover:text-[var(--gold-soft)] transition-colors"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Dramatis Personae / Cast */}
            {video.cast?.length > 0 && (
              <div className="border-t border-white/[0.06] pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.16em] text-[var(--gold,#d9a653)]">
                    Dramatis Personae & Ensemble
                  </h3>
                  <span className="font-[var(--font-mono)] text-[0.62rem] text-[var(--mauve)]">
                    {video.cast.length} Recorded
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {video.cast.map((member) => (
                    <div
                      key={member._id || member.name}
                      className="group flex items-center gap-3 rounded border border-white/[0.06] bg-[#140f17]/70 p-2.5 transition hover:border-white/[0.16]"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.1] bg-[#1a141e]">
                        {member.photoUrl ? (
                          <img
                            src={member.photoUrl}
                            alt={member.name}
                            className="h-full w-full object-cover grayscale contrast-125 transition group-hover:grayscale-0"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-[var(--font-mono)] text-xs text-[var(--mauve)]">
                            {member.name ? member.name.charAt(0) : "•"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--parchment)]">
                          {member.name}
                        </p>
                        {member.characterName && (
                          <p className="truncate font-[var(--font-mono)] text-[0.68rem] text-[var(--mauve)]">
                            as{" "}
                            <span className="text-[var(--gold-soft)]">
                              {member.characterName}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar / Archival Technical Spec Sheet */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 rounded-sm border border-white/[0.08] bg-[#130f16]/80 p-5 backdrop-blur-md">
              <div className="mb-4 flex items-center gap-2 border-b border-white/[0.08] pb-3">
                <FilmReelIcon className="text-[var(--gold)] h-28" />
                <h3 className="font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.16em] text-[var(--gold)]">
                  Master Technical Log
                </h3>
              </div>

              <dl className="space-y-3 font-[var(--font-mono)] text-[0.7rem]">
                {video.resolutions?.length > 0 && (
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                    <dt className="text-[var(--mauve)]">Resolutions</dt>
                    <dd className="font-semibold text-[var(--parchment)]">
                      {video.resolutions.join(" • ")}
                    </dd>
                  </div>
                )}

                {formatFileSize(video.fileSizeBytes) && (
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                    <dt className="text-[var(--mauve)]">Payload Size</dt>
                    <dd className="text-[var(--parchment)]">
                      {formatFileSize(video.fileSizeBytes)}
                    </dd>
                  </div>
                )}

                {video.mimeType && (
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                    <dt className="text-[var(--mauve)]">Codec / Container</dt>
                    <dd className="text-[var(--parchment)] uppercase">
                      {video.mimeType}
                    </dd>
                  </div>
                )}

                {formatDate(video.uploadedAt) && (
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                    <dt className="text-[var(--mauve)]">Ingested</dt>
                    <dd className="text-[var(--parchment)]">
                      {formatDate(video.uploadedAt)}
                    </dd>
                  </div>
                )}

                {formatDate(video.publishedAt) && (
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                    <dt className="text-[var(--mauve)]">Published</dt>
                    <dd className="text-[var(--parchment)]">
                      {formatDate(video.publishedAt)}
                    </dd>
                  </div>
                )}

                {formatDate(video.updatedAt) && (
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                    <dt className="text-[var(--mauve)]">Last Revised</dt>
                    <dd className="text-[var(--parchment)]">
                      {formatDate(video.updatedAt)}
                    </dd>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <dt className="text-[var(--mauve)]">HLS Pipeline</dt>
                  <dd className="text-[#7ad399] font-medium">Ready (VOD)</dd>
                </div>
              </dl>

              <div className="mt-5 border-t border-white/[0.08] pt-4 text-[0.62rem] font-[var(--font-mono)] uppercase tracking-wider text-[var(--mauve)]/70">
                Encrypted & Stored in Director Vault
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Error Toast */}
      {deleteError && (
        <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded border border-[var(--error)]/40 bg-[#1a0e10] px-4 py-3 text-xs text-[var(--error)] shadow-2xl backdrop-blur-md">
          {deleteError}
        </div>
      )}

      {/* Moderation Notice Modal */}
      {showModerationNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-md border border-[var(--error)]/40 bg-[#160f14] p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--error)]" />
              <p className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.14em] text-[var(--error)]">
                Archive Review Notice
              </p>
            </div>

            <h4 className="mb-2 font-[var(--font-display,serif)] text-xl text-[var(--parchment)]">
              Revisions required before distribution
            </h4>

            <p className="mb-4 text-xs leading-relaxed text-[var(--parchment)]/80 bg-black/40 p-3 rounded border border-white/[0.05]">
              {video.moderationComment ||
                "No specific feedback was attached by the screening committee."}
            </p>

            {formatDate(video.moderatedAt) && (
              <p className="mb-5 font-[var(--font-mono)] text-[0.62rem] text-[var(--mauve)]">
                Logged by curator on {formatDate(video.moderatedAt)}
              </p>
            )}

            <button
              onClick={() => setShowModerationNotice(false)}
              className="w-full rounded bg-[var(--gold)] py-2 font-[var(--font-mono)] text-xs uppercase tracking-wider font-semibold text-black transition hover:bg-[var(--gold-soft)]"
            >
              Acknowledge Notes
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Decommission Film?"
        message={`Remove "${video.title}" from the Director's Vault? This action is permanent.`}
        confirmLabel="Decommission"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
