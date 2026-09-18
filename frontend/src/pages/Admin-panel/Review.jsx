import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Film,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  StickyNote,
  Tag,
  User,
  X,
} from "lucide-react";
import { getRequest, postEmpty, postJson, putJson } from "../../api/client.js";
import AdminVideoPlayer from "../../components/admin/AdminVideoPlayer.jsx";

export default function Review() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [selected, setSelected] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const [watchData, setWatchData] = useState(null);
  const [watchLoading, setWatchLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  const [contentWarningsText, setContentWarningsText] = useState("");
  const [cwBusy, setCwBusy] = useState(false);

  const [featuredBusy, setFeaturedBusy] = useState(false);
  const [ageBusy, setAgeBusy] = useState(false);

  const [directorDetail, setDirectorDetail] = useState(null);
  const [directorBusy, setDirectorBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await getRequest("/admin/videos?status=pending");
      setVideos(Array.isArray(data?.videos) ? data.videos : []);
    } catch (err) {
      setVideos([]);
      setError(err.message || "Unable to load review queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v) =>
      [v.title, v.description, v.language, v.directorId]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q)),
    );
  }, [videos, searchQuery]);

  async function openReview(video) {
    setSelected(video);
    setSelectedDetail(video);
    setWatchData(null);
    setComment("");
    setWatchLoading(true);
    setDetailLoading(true);
    setError("");

    setNotes([]);
    setNotesLoading(true);
    setContentWarningsText((video.contentWarnings || []).join(", "));
    setDirectorDetail(null);

    const [detailResult, watchResult, notesResult, directorResult] =
      await Promise.allSettled([
        getRequest(`/admin/videos/${video._id}`),
        getRequest(`/admin/videos/${video._id}/watch`),
        getRequest(`/admin/videos/${video._id}/notes`),
        video.directorId
          ? getRequest(`/admin/directors/${video.directorId}`)
          : Promise.resolve(null),
      ]);

    if (detailResult.status === "fulfilled") {
      setSelectedDetail(detailResult.value);
      setContentWarningsText(
        (detailResult.value?.contentWarnings || []).join(", "),
      );
    }

    if (watchResult.status === "fulfilled") {
      setWatchData(watchResult.value);
    }

    if (notesResult.status === "fulfilled") {
      setNotes(
        Array.isArray(notesResult.value?.notes) ? notesResult.value.notes : [],
      );
    }

    if (directorResult.status === "fulfilled" && directorResult.value) {
      setDirectorDetail(directorResult.value);
    }

    if (
      detailResult.status === "rejected" &&
      watchResult.status === "rejected"
    ) {
      setError(
        detailResult.reason?.message ||
          watchResult.reason?.message ||
          "Unable to load video.",
      );
    }

    setDetailLoading(false);
    setWatchLoading(false);
    setNotesLoading(false);
  }

  function closeReview() {
    setSelected(null);
    setSelectedDetail(null);
    setWatchData(null);
    setComment("");
    setNotes([]);
    setNoteText("");
    setContentWarningsText("");
    setDirectorDetail(null);
  }

  async function moderate(kind) {
    if (!selected) return;

    if (kind === "reject" && comment.trim().length < 3) {
      setError("Please provide a rejection reason (min 3 characters).");
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (kind === "approve") {
        await postJson(`/admin/videos/${selected._id}/approve`, {
          comment: comment.trim() || null,
        });
      } else {
        await postJson(`/admin/videos/${selected._id}/reject`, {
          reason: comment.trim(),
        });
      }

      closeReview();
      await load();
    } catch (err) {
      setError(err.message || "Moderation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFeatured() {
    const video = selectedDetail || selected;
    if (!video) return;

    setFeaturedBusy(true);
    setError("");

    try {
      await postJson(`/admin/videos/${video._id}/featured`, {
        isFeatured: !video.isFeatured,
      });

      const updated = await getRequest(`/admin/videos/${video._id}`);
      setSelectedDetail(updated);
    } catch (err) {
      setError(err.message || "Unable to update featured status.");
    } finally {
      setFeaturedBusy(false);
    }
  }

  async function toggleAgeRestriction() {
    const video = selectedDetail || selected;
    if (!video) return;

    setAgeBusy(true);
    setError("");

    try {
      await postJson(`/admin/videos/${video._id}/age-restriction`, {
        ageRestricted: !video.ageRestricted,
      });

      const updated = await getRequest(`/admin/videos/${video._id}`);
      setSelectedDetail(updated);
    } catch (err) {
      setError(err.message || "Unable to update age restriction.");
    } finally {
      setAgeBusy(false);
    }
  }

  async function saveContentWarnings() {
    const video = selectedDetail || selected;
    if (!video) return;

    setCwBusy(true);
    setError("");

    try {
      const warnings = contentWarningsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      await putJson(`/admin/videos/${video._id}/content-warnings`, {
        contentWarnings: warnings,
      });

      const updated = await getRequest(`/admin/videos/${video._id}`);
      setSelectedDetail(updated);
    } catch (err) {
      setError(err.message || "Unable to save content warnings.");
    } finally {
      setCwBusy(false);
    }
  }

  async function addNote() {
    const video = selectedDetail || selected;
    if (!video || !noteText.trim()) return;

    setNoteBusy(true);
    setError("");

    try {
      await postJson(`/admin/videos/${video._id}/notes`, {
        note: noteText.trim(),
      });

      setNoteText("");
      const data = await getRequest(`/admin/videos/${video._id}/notes`);
      setNotes(Array.isArray(data?.notes) ? data.notes : []);
    } catch (err) {
      setError(err.message || "Unable to add note.");
    } finally {
      setNoteBusy(false);
    }
  }

  async function suspendDirector() {
    if (!directorDetail?.director?._id) return;

    const reason = window.prompt("Reason for suspending this director:");
    if (!reason || reason.trim().length < 3) return;

    setDirectorBusy(true);
    setError("");

    try {
      await postJson(
        `/admin/directors/${directorDetail.director._id}/suspend`,
        { reason: reason.trim() },
      );

      const updated = await getRequest(
        `/admin/directors/${directorDetail.director._id}`,
      );
      setDirectorDetail(updated);
    } catch (err) {
      setError(err.message || "Unable to suspend director.");
    } finally {
      setDirectorBusy(false);
    }
  }

  async function unsuspendDirector() {
    if (!directorDetail?.director?._id) return;

    setDirectorBusy(true);
    setError("");

    try {
      await postEmpty(
        `/admin/directors/${directorDetail.director._id}/unsuspend`,
      );

      const updated = await getRequest(
        `/admin/directors/${directorDetail.director._id}`,
      );
      setDirectorDetail(updated);
    } catch (err) {
      setError(err.message || "Unable to reinstate director.");
    } finally {
      setDirectorBusy(false);
    }
  }

  const activeVideo = selectedDetail || selected;

  return (
    <div className="space-y-6">
      {/* Top Header & Queue Status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#d9a653] animate-pulse" />
            <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[.2em] text-[#d9a653]">
              Quality Assurance & Moderation
            </p>
          </div>
          <h2 className="mt-1 font-[var(--font-display)] text-3xl text-[#efe7da]">
            Review Queue
          </h2>
          <p className="mt-1 text-sm text-[#8b7c82]">
            Screen and approve submitted films before distribution to the public catalog.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.02] px-4 py-2.5 text-[10px] uppercase tracking-[.12em] text-[#d9d0d2] hover:bg-white/[0.06] hover:text-white disabled:opacity-50 transition"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh Queue
        </button>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#d9a653]/30 bg-[#d9a653]/[0.06] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#d9a653]">
              Awaiting Action
            </span>
            <Clock size={14} className="text-[#d9a653]" />
          </div>
          <p className="mt-2 font-[var(--font-display)] text-2xl text-[#efe7da]">
            {videos.length}
          </p>
          <p className="mt-0.5 text-[11px] text-[#8b7c82]">
            Submissions in review pipeline
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8b7c82]">
              Queue Health
            </span>
            <ShieldCheck size={14} className="text-[#7fc59b]" />
          </div>
          <p className="mt-2 font-[var(--font-display)] text-2xl text-[#efe7da]">
            {videos.length > 5 ? "Elevated" : "Normal"}
          </p>
          <p className="mt-0.5 text-[11px] text-[#8b7c82]">
            {videos.length > 0 ? "Moderation required" : "All cleared"}
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8b7c82]">
              Instant Search
            </span>
            <Search size={14} className="text-[#71656a]" />
          </div>
          <div className="mt-2 flex items-center gap-2 border-b border-white/10 pb-1">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title or director…"
              className="w-full bg-transparent text-xs text-[#efe7da] outline-none placeholder:text-[#71656a]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-[#71656a] hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/[0.07] p-4 text-sm text-[#e08a6b]">
          {error}
        </div>
      )}

      {/* Main Queue Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-72 animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.02]"
            />
          ))}
        </div>
      ) : filteredVideos.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredVideos.map((video) => (
            <article
              key={video._id}
              onClick={() => openReview(video)}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition duration-200 hover:border-[#d9a653]/40 hover:bg-white/[0.035]"
            >
              {/* Thumbnail with Cinema HUD Brackets & Fallback Slate */}
              <div className="relative aspect-video w-full bg-[#0d0a0d] flex items-center justify-center overflow-hidden">
                <Film size={26} className="text-white/10 pointer-events-none" />

                {video.thumbnailUrl && (
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02] group-hover:brightness-105"
                  />
                )}

                {/* HUD corner brackets */}
                <span className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 border-l border-t border-[#d9a653]/60" />
                <span className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 border-r border-t border-[#d9a653]/60" />
                <span className="pointer-events-none absolute bottom-2.5 left-2.5 h-3.5 w-3.5 border-b border-l border-[#d9a653]/60" />
                <span className="pointer-events-none absolute bottom-2.5 right-2.5 h-3.5 w-3.5 border-b border-r border-[#d9a653]/60" />

                {/* Play Preview Overlay */}
                <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100 bg-black/30 backdrop-blur-[1px]">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-black/80 border border-[#d9a653]/40 text-[#d9a653] shadow-lg">
                    <Play size={15} fill="currentColor" />
                  </span>
                </span>

                {/* Status Badge */}
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-[#d9a653]/40 bg-black/70 px-2.5 py-0.5 font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[#d9a653] backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d9a653] animate-pulse" />
                  Pending
                </span>
              </div>

              {/* Card Body */}
              <div className="p-4">
                <h3 className="truncate font-[var(--font-display)] text-base text-[#efe7da] group-hover:text-[#d9a653] transition">
                  {video.title || "Untitled Video"}
                </h3>

                <div className="mt-1.5 flex items-center gap-2 font-[var(--font-mono)] text-[9px] uppercase tracking-[.1em] text-[#71656a]">
                  <span>
                    {video.uploadedAt
                      ? new Date(video.uploadedAt).toLocaleDateString()
                      : "—"}
                  </span>
                  <span>/</span>
                  <span className="truncate">
                    {video.directorId ? `DIR: ${String(video.directorId).slice(-6)}` : "DIR: —"}
                  </span>
                  {video.language && (
                    <>
                      <span>/</span>
                      <span className="uppercase">{video.language}</span>
                    </>
                  )}
                </div>

                <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-[#8b7c82]">
                  {video.description || "No description supplied."}
                </p>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-[#71656a]">
                  <span>
                    {Array.isArray(video.cast) && video.cast.length > 0
                      ? `${video.cast.length} Cast Member${video.cast.length === 1 ? "" : "s"}`
                      : "General Submission"}
                  </span>

                  <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[#8b7c82] group-hover:text-[#d9a653] transition">
                    Open Dossier &rarr;
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-16 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04] border border-white/[0.08] text-[#7fc59b]">
            <ShieldCheck size={28} />
          </div>
          <h3 className="mt-4 font-[var(--font-display)] text-xl text-[#efe7da]">
            Review Queue Clear
          </h3>
          <p className="mt-1 text-sm text-[#71656a] max-w-sm mx-auto">
            {searchQuery
              ? "No pending films match your current search query."
              : "All submitted videos have been reviewed and published."}
          </p>
        </div>
      )}

      {/* Review & Screening Modal (Optimized for 100% Zoom) */}
      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md"
          onClick={() => {
            if (!busy) closeReview();
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative flex flex-col lg:flex-row w-full max-w-5xl max-h-[86vh] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#140f13] shadow-[0_25px_80px_rgba(0,0,0,0.85)]"
          >
            {/* Left Column: Screening Player */}
            <div className="lg:w-[55%] flex flex-col bg-black/90 border-b lg:border-b-0 lg:border-r border-white/[0.08] relative">
              {/* Top Screening Bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.01]">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d9a653] animate-pulse" />
                  <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-[.2em] text-[#d9a653]">
                    Screening Player
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9a653]/30 bg-[#d9a653]/10 px-2.5 py-0.5 font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[#d9a653]">
                  Awaiting Decision
                </span>
              </div>

              {/* Theater Video Player Container */}
              <div className="p-3 sm:p-4 bg-gradient-to-b from-black via-[#0e0a0e] to-black shrink-0 border-b border-white/[0.06]">
                <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-black shadow-2xl relative">
                  {watchLoading ? (
                    <div className="grid h-full w-full place-items-center bg-black">
                      <div className="flex items-center gap-2 text-xs text-[#8b7c82]">
                        <RefreshCw size={15} className="animate-spin text-[#d9a653]" />
                        <span>Loading secure stream…</span>
                      </div>
                    </div>
                  ) : watchData?.stream_url ? (
                    <AdminVideoPlayer
                      src={watchData.stream_url}
                      poster={activeVideo?.thumbnailUrl}
                      title={activeVideo?.title}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-black/80 p-4 text-center">
                      <p className="text-xs text-[#8b7c82]">
                        The backend did not return a stream URL.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Player Metadata Strip */}
              <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.015] flex flex-wrap items-center justify-between gap-2 font-[var(--font-mono)] text-[9px] text-[#71656a] shrink-0">
                <div className="truncate max-w-[200px]">
                  ID: <span className="text-[#b8acb0]">{selected._id}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span>LANG: <strong className="text-[#b8acb0]">{activeVideo?.language || "—"}</strong></span>
                  <span>•</span>
                  <span>
                    {activeVideo?.uploadedAt
                      ? new Date(activeVideo.uploadedAt).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Review Dossier */}
            <div className="lg:w-[45%] flex flex-col bg-[#171216] max-h-[86vh]">
              {/* Sticky Header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-3.5 bg-[#171216]/95 backdrop-blur shrink-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-[var(--font-mono)] text-[8.5px] uppercase tracking-[.18em] text-[#d9a653]">
                      Moderation Dossier
                    </p>
                    {activeVideo?.ageRestricted && (
                      <span className="rounded bg-[#e08a6b]/20 px-1.5 py-0.2 text-[8px] font-bold text-[#e08a6b]">
                        18+
                      </span>
                    )}
                    {activeVideo?.isFeatured && (
                      <span className="rounded bg-[#d9a653]/20 px-1.5 py-0.2 text-[8px] font-bold text-[#d9a653]">
                        FEATURED
                      </span>
                    )}
                  </div>

                  <h3
                    className="mt-0.5 truncate font-[var(--font-display)] text-lg sm:text-xl text-[#efe7da]"
                    title={activeVideo?.title}
                  >
                    {activeVideo?.title || "Untitled Video"}
                  </h3>
                </div>

                <button
                  disabled={busy}
                  onClick={closeReview}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-[#b8acb0] hover:bg-white/[0.1] hover:text-white transition disabled:opacity-50"
                  aria-label="Close review"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Scrollable Dossier Body with Custom Thin Scrollbar */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/25"
                style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
              >
                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <p className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">Status</p>
                    <p className="mt-1 text-xs font-semibold text-[#d9a653]">Pending</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <p className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">Language</p>
                    <p className="mt-1 text-xs font-medium text-[#efe7da] truncate">
                      {activeVideo?.language || "Not set"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <p className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">Uploaded</p>
                    <p className="mt-1 text-xs text-[#b8acb0] truncate">
                      {activeVideo?.uploadedAt
                        ? new Date(activeVideo.uploadedAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">Description</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#b8acb0]">
                    {activeVideo?.description || "No description supplied."}
                  </p>
                </div>

                {/* Cast & Crew Section */}
                {Array.isArray(activeVideo?.cast) && activeVideo.cast.length > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">
                      Cast & Characters
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeVideo.cast.map((member, index) => (
                        <div
                          key={member._id || index}
                          className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] p-1.5 pr-2.5"
                        >
                          {member.photoUrl ? (
                            <img
                              src={member.photoUrl}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover border border-white/10"
                            />
                          ) : (
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#d9a653]/10 border border-[#d9a653]/30 text-[9px] font-bold text-[#d9a653]">
                              {(member.name || "?")[0]?.toUpperCase()}
                            </span>
                          )}

                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-[#efe7da]">
                              {member.name || "Unnamed"}
                            </p>
                            {member.characterName && (
                              <p className="truncate text-[9px] text-[#71656a]">
                                as {member.characterName}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tactile Toggle Controls: Age Restriction & Featured */}
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div
                    onClick={!ageBusy ? toggleAgeRestriction : undefined}
                    className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                      activeVideo?.ageRestricted
                        ? "border-[#e08a6b]/40 bg-[#e08a6b]/[0.08]"
                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.15]"
                    } ${ageBusy ? "cursor-wait opacity-60" : ""}`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle
                          size={12}
                          className={activeVideo?.ageRestricted ? "text-[#e08a6b]" : "text-[#71656a]"}
                        />
                        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#d9d0d2]">
                          Age Gate
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[#8b7c82]">
                        {activeVideo?.ageRestricted ? "18+ Restricted" : "General Audience"}
                      </p>
                    </div>

                    <div
                      className={`relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                        activeVideo?.ageRestricted ? "bg-[#e08a6b]" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`h-3.5 w-3.5 transform rounded-full bg-[#100d10] shadow-md transition-transform ${
                          activeVideo?.ageRestricted ? "translate-x-3.5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>

                  <div
                    onClick={!featuredBusy ? toggleFeatured : undefined}
                    className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                      activeVideo?.isFeatured
                        ? "border-[#d9a653]/40 bg-[#d9a653]/[0.08]"
                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.15]"
                    } ${featuredBusy ? "cursor-wait opacity-60" : ""}`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Star
                          size={12}
                          className={activeVideo?.isFeatured ? "text-[#d9a653]" : "text-[#71656a]"}
                          fill={activeVideo?.isFeatured ? "currentColor" : "none"}
                        />
                        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#d9d0d2]">
                          Featured
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[#8b7c82]">
                        {activeVideo?.isFeatured ? "Promoted" : "Standard"}
                      </p>
                    </div>

                    <div
                      className={`relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                        activeVideo?.isFeatured ? "bg-[#d9a653]" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`h-3.5 w-3.5 transform rounded-full bg-[#100d10] shadow-md transition-transform ${
                          activeVideo?.isFeatured ? "translate-x-3.5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Content Warnings */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">
                      Content Warnings
                    </p>
                    <Tag size={12} className="text-[#71656a]" />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {contentWarningsText
                      .split(",")
                      .map((w) => w.trim())
                      .filter(Boolean).length > 0 ? (
                      contentWarningsText
                        .split(",")
                        .map((w) => w.trim())
                        .filter(Boolean)
                        .map((warning, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e08a6b]/30 bg-[#e08a6b]/10 px-2 py-0.5 text-[9.5px] font-medium text-[#e08a6b]"
                          >
                            <span>{warning}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const list = contentWarningsText
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean)
                                  .filter((item) => item !== warning);
                                setContentWarningsText(list.join(", "));
                              }}
                              className="text-[#e08a6b]/60 hover:text-[#e08a6b]"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))
                    ) : (
                      <span className="text-[11px] text-[#71656a]">
                        No content warnings registered.
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="text-[8.5px] text-[#71656a] mr-1">Quick add:</span>
                    {["gore", "violence", "flashing lights", "nudity", "profanity"].map((preset) => {
                      const active = contentWarningsText
                        .split(",")
                        .map((w) => w.trim().toLowerCase())
                        .includes(preset);
                      if (active) return null;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            const list = contentWarningsText
                              .split(",")
                              .map((w) => w.trim())
                              .filter(Boolean);
                            setContentWarningsText([...list, preset].join(", "));
                          }}
                          className="rounded border border-white/[0.08] bg-white/[0.02] px-1.5 py-0.5 text-[8.5px] text-[#8b7c82] hover:border-white/20 hover:text-white transition"
                        >
                          + {preset}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2.5 flex gap-2">
                    <input
                      value={contentWarningsText}
                      onChange={(e) => setContentWarningsText(e.target.value)}
                      placeholder="Comma-separated warnings…"
                      className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/40"
                    />
                    <button
                      disabled={cwBusy}
                      onClick={saveContentWarnings}
                      className="rounded-lg bg-white/[0.05] border border-white/10 px-2.5 py-1 text-[8.5px] uppercase tracking-wider text-[#d9d0d2] hover:bg-white/[0.1] disabled:opacity-50 transition"
                    >
                      {cwBusy ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>

                {/* Director Dossier */}
                {directorDetail && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">Director</p>
                      <User size={12} className="text-[#71656a]" />
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] border border-white/10 font-bold text-xs text-[#d9a653]">
                          {(directorDetail.director?.username || "D")[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#efe7da]">
                            {directorDetail.director?.username || "Unknown director"}
                          </p>
                          <p className="text-[9.5px] text-[#71656a]">
                            Status:{" "}
                            <span
                              className={
                                directorDetail.director?.accountStatus === "suspended"
                                  ? "text-[#e08a6b]"
                                  : "text-[#7fc59b]"
                              }
                            >
                              {directorDetail.director?.accountStatus || "active"}
                            </span>{" "}
                            · {directorDetail.videoCount ?? 0} video
                            {directorDetail.videoCount === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>

                      {directorDetail.director?.accountStatus === "suspended" ? (
                        <button
                          disabled={directorBusy}
                          onClick={unsuspendDirector}
                          className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[8.5px] uppercase tracking-wider text-[#7fc59b] hover:bg-[#7fc59b]/10 disabled:opacity-50 transition"
                        >
                          Reinstate
                        </button>
                      ) : (
                        <button
                          disabled={directorBusy}
                          onClick={suspendDirector}
                          className="rounded-lg border border-[#e08a6b]/30 px-2.5 py-1 text-[8.5px] uppercase tracking-wider text-[#e08a6b] hover:bg-[#e08a6b]/10 disabled:opacity-50 transition"
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Internal Admin Notes */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">
                      Internal Notes
                    </p>
                    <StickyNote size={12} className="text-[#71656a]" />
                  </div>

                  <div className="mt-2 max-h-28 space-y-1.5 overflow-y-auto pr-1">
                    {notesLoading ? (
                      <p className="text-xs text-[#71656a]">Loading notes…</p>
                    ) : notes.length ? (
                      notes.map((note, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-xs text-[#b8acb0]"
                        >
                          <p>{note.note}</p>
                          <p className="mt-1 text-[8.5px] text-[#71656a]">
                            {note.addedAt ? new Date(note.addedAt).toLocaleString() : ""}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10.5px] text-[#71656a]">
                        No internal notes yet.
                      </p>
                    )}
                  </div>

                  <div className="mt-2.5 flex gap-2">
                    <input
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Add private note…"
                      className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/40"
                    />
                    <button
                      disabled={noteBusy || !noteText.trim()}
                      onClick={addNote}
                      className="rounded-lg bg-white/[0.05] border border-white/10 px-2.5 py-1 text-[8.5px] uppercase tracking-wider text-[#d9d0d2] hover:bg-white/[0.1] disabled:opacity-40 transition"
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>

              {/* Sticky Action Footer with Moderator Note & Buttons */}
              <div className="p-3.5 border-t border-white/[0.08] bg-[#140f13]/95 backdrop-blur shrink-0 space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">
                      Moderator Note
                    </span>
                    {comment.trim().length > 0 && comment.trim().length < 3 && (
                      <span className="text-[8.5px] text-[#e08a6b]">Min. 3 characters to reject</span>
                    )}
                  </div>
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Optional approval note or reason for rejection…"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/40"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={busy || comment.trim().length < 3}
                    onClick={() => moderate("reject")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/10 py-2.5 text-[9.5px] font-semibold uppercase tracking-wider text-[#e08a6b] hover:bg-[#e08a6b]/20 disabled:opacity-40 transition"
                    title={comment.trim().length < 3 ? "Enter a reason above to reject" : "Reject video"}
                  >
                    <X size={13} />
                    Reject Video
                  </button>

                  <button
                    disabled={busy}
                    onClick={() => moderate("approve")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#d9a653] py-2.5 text-[9.5px] font-semibold uppercase tracking-wider text-[#100d10] hover:brightness-110 disabled:opacity-50 shadow-md shadow-[#d9a653]/20 transition"
                  >
                    <Check size={13} />
                    Approve Film
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}