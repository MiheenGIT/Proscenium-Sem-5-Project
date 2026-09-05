import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, NavLink } from "react-router-dom";
import Plyr from "plyr";
import Hls from "hls.js";
import "plyr/dist/plyr.css";
import { getRequest, deleteRequest, postEmpty } from "../../api/client";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

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

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
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
  return h ? `${h}:${String(m).padStart(2, "0")}:${rem}` : `${mm}:${rem}`;
}

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
        if (!cancelled) setError(err.message || "Failed to load video");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleResubmit() {
    setResubmitError(null);
    setResubmitting(true);
    try {
      await postEmpty(`/directors/videos/${id}/resubmit`);
      setVideo((prev) => ({ ...prev, moderationStatus: "pending", moderationComment: null }));
    } catch (err) {
      setResubmitError(err.message || "Resubmit failed");
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
        console.log("HLS levels:", hls.levels);

        // Get the actual resolutions from master.m3u8
        const qualities = hls.levels
          .map((level) => level.height)
          .filter((height) => height)
          .sort((a, b) => a - b);

        console.log("Available qualities:", qualities);

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

              console.log(
                `Changing quality to ${quality}p, HLS level: ${levelIndex}`,
              );

              if (levelIndex !== -1) {
                hls.currentLevel = levelIndex;
              }
            },
          },
        };

        // Create Plyr AFTER we know the available HLS qualities
        player = new Plyr(el, plyrOptions);
        plyrRef.current = player;
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error("HLS error:", data);

        if (data.fatal) {
          setError("Playback error — the stream failed to load.");
        }
      });
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari / native HLS
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
      setError("This browser doesn't support HLS playback.");
    }

    return () => {
      if (hls) {
        hls.destroy();
        hls = null;
        hlsRef.current = null;
      }

      if (player) {
        player.destroy();
        player = null;
        plyrRef.current = null;
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
            <NavLink
              to={`/director/videos/${video.id}/edit`}
              className="ml-auto flex items-center gap-1.5 rounded-[3px] border border-[rgba(239,231,218,0.16)] px-3 py-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.06em] text-[var(--parchment)] transition-colors hover:border-[var(--gold)]"
            >
              <EditIcon /> Edit
            </NavLink>
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-[3px] border border-[rgba(224,138,107,0.4)] px-3 py-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.06em] text-[var(--error)] transition-colors hover:bg-[rgba(224,138,107,0.08)] disabled:opacity-50"
            >
              {deleting ? "…" : "Delete"}
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-3 font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.06em] text-[var(--mauve)]">
            <span>{video.visibility}</span>
            <span>{video.views ?? 0} views</span>
            {video.durationSec ? (
              <span>{formatDuration(video.durationSec)}</span>
            ) : null}
            {video.releaseYear && <span>{video.releaseYear}</span>}
            {video.language && <span>{video.language}</span>}
            {video.productionCountry && <span>{video.productionCountry}</span>}
          </div>

          {video.description && (
            <p className="mb-4 max-w-2xl text-sm leading-relaxed text-[var(--parchment)]">
              {video.description}
            </p>
          )}

          {video.genres?.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
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

          {video.tags?.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {video.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-[3px] bg-[rgba(239,231,218,0.06)] px-2 py-0.5 font-[var(--font-mono)] text-[0.68rem] text-[var(--mauve)]"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {video.cast?.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.14em] text-[var(--gold)]">
                Cast
              </h2>
              <div className="flex flex-wrap gap-4">
                {video.cast.map((c) => (
                  <div
                    key={c._id}
                    className="flex items-center gap-2.5 rounded-[3px] border border-[rgba(239,231,218,0.12)] bg-[#0f0c11] px-3 py-2"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--velvet-deep)]">
                      {c.photoUrl ? (
                        <img
                          src={c.photoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="text-sm leading-tight">
                      <p className="text-[var(--parchment)]">{c.name}</p>
                      {c.characterName && (
                        <p className="text-xs text-[var(--mauve)]">
                          as {c.characterName}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[3px] border border-[rgba(239,231,218,0.12)] bg-[#0f0c11] p-4">
            <h2 className="mb-3 font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.14em] text-[var(--gold)]">
              File Details
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
              {formatDate(video.uploadedAt) && (
                <div>
                  <dt className="text-[var(--mauve)]">Uploaded</dt>
                  <dd className="text-[var(--parchment)]">
                    {formatDate(video.uploadedAt)}
                  </dd>
                </div>
              )}
              {formatDate(video.publishedAt) && (
                <div>
                  <dt className="text-[var(--mauve)]">Published</dt>
                  <dd className="text-[var(--parchment)]">
                    {formatDate(video.publishedAt)}
                  </dd>
                </div>
              )}
              {formatDate(video.updatedAt) && (
                <div>
                  <dt className="text-[var(--mauve)]">Last updated</dt>
                  <dd className="text-[var(--parchment)]">
                    {formatDate(video.updatedAt)}
                  </dd>
                </div>
              )}
              {video.resolutions?.length > 0 && (
                <div>
                  <dt className="text-[var(--mauve)]">Available quality</dt>
                  <dd className="text-[var(--parchment)]">
                    {video.resolutions.join(", ")}
                  </dd>
                </div>
              )}
              {formatFileSize(video.fileSizeBytes) && (
                <div>
                  <dt className="text-[var(--mauve)]">File size</dt>
                  <dd className="text-[var(--parchment)]">
                    {formatFileSize(video.fileSizeBytes)}
                  </dd>
                </div>
              )}
              {video.mimeType && (
                <div>
                  <dt className="text-[var(--mauve)]">Format</dt>
                  <dd className="text-[var(--parchment)]">{video.mimeType}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {deleteError && (
        <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-[3px] border border-[rgba(224,138,107,0.4)] bg-[rgba(224,138,107,0.12)] px-4 py-3 text-sm text-[var(--error)]">
          {deleteError}
        </div>
      )}

      {showModerationNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(16,13,16,0.75)] p-4">
          <div className="w-full max-w-md rounded-[4px] border border-[rgba(224,138,107,0.4)] bg-[#17131a] p-6">
            <p className="mb-2 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--error)]">
              This film was rejected
            </p>
            <p className="mb-4 text-sm leading-relaxed text-[var(--parchment)]">
              {video.moderationComment || "No reason was provided by the reviewer."}
            </p>
            {formatDate(video.moderatedAt) && (
              <p className="mb-5 text-xs text-[var(--mauve)]">
                Reviewed on {formatDate(video.moderatedAt)}
              </p>
            )}
            <button
              onClick={() => setShowModerationNotice(false)}
              className="w-full rounded-[3px] bg-[var(--gold)] py-2.5 text-sm font-semibold text-[#1a1210] hover:bg-[var(--gold-soft)]"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {!showModerationNotice && video.moderationStatus === "rejected" && (
        <div className="fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2">
          <button
            onClick={handleResubmit}
            disabled={resubmitting}
            className="rounded-[3px] border border-[rgba(217,166,83,0.4)] bg-[#17131a] px-5 py-2.5 font-[var(--font-mono)] text-[0.72rem] uppercase tracking-[0.06em] text-[var(--gold-soft)] hover:bg-[rgba(217,166,83,0.1)] disabled:opacity-50"
          >
            {resubmitting ? "Resubmitting…" : "Resubmit for review"}
          </button>
          {resubmitError && <p className="text-xs text-[var(--error)]">{resubmitError}</p>}
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete film?"
        message={`Delete "${video.title}"? This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
