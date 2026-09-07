import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  StickyNote,
  Tag,
  User,
  X,
} from "lucide-react";
import { getRequest, postEmpty, postJson, putJson } from "../../api/client.js";
import AdminVideoPlayer from "../../components/admin/AdminVideoPlayer.jsx";

function normalizeVideos(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.videos)) return data.videos;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

const STATUS_META = {
  approved: {
    label: "Approved",
    dot: "bg-[#7fc59b]",
    text: "text-[#7fc59b]",
    bg: "bg-[#7fc59b]/10",
    ring: "border-[#7fc59b]/30",
  },
  rejected: {
    label: "Rejected",
    dot: "bg-[#e08a6b]",
    text: "text-[#e08a6b]",
    bg: "bg-[#e08a6b]/10",
    ring: "border-[#e08a6b]/30",
  },
  pending: {
    label: "Pending",
    dot: "bg-[#d9a653]",
    text: "text-[#d9a653]",
    bg: "bg-[#d9a653]/10",
    ring: "border-[#d9a653]/30",
  },
  unknown: {
    label: "Unknown",
    dot: "bg-[#a99da1]",
    text: "text-[#a99da1]",
    bg: "bg-white/[0.05]",
    ring: "border-white/10",
  },
};

function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.unknown;
}

function shortId(id) {
  if (!id) return "—";
  return `${String(id).slice(0, 6)}…${String(id).slice(-4)}`;
}

function StatusBadge({ status, size = "normal" }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-[var(--font-mono)] uppercase tracking-wider ${meta.bg} ${meta.text} ${meta.ring} ${
        size === "sm" ? "text-[9px]" : "text-[10px]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} animate-pulse`} />
      {meta.label}
    </span>
  );
}

export default function Content() {
  const [videos, setVideos] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [watchData, setWatchData] = useState(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);

  const [action, setAction] = useState(null);
  const [moderationText, setModerationText] = useState("");
  const [moderationBusy, setModerationBusy] = useState(false);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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
      const path =
        status === "all"
          ? "/admin/videos"
          : `/admin/videos?status=${encodeURIComponent(status)}`;

      const data = await getRequest(path);
      setVideos(normalizeVideos(data));
    } catch (err) {
      setVideos([]);
      setError(err.message || "Unable to load videos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  const filteredVideos = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return videos;

    return videos.filter((video) => {
      return [video.title, video.description, video.language, video.directorId]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    });
  }, [videos, query]);

  async function openVideo(video) {
    setSelected(video);
    setSelectedDetail(video);
    setWatchData(null);
    setDetailLoading(true);
    setWatchLoading(true);
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

  function closeVideo() {
    setSelected(null);
    setSelectedDetail(null);
    setWatchData(null);
    setModerationText("");
    setModerationBusy(false);
    setNotes([]);
    setNoteText("");
    setContentWarningsText("");
    setDirectorDetail(null);
  }

  function askModeration(kind, video) {
    setAction({ kind, video });
    setModerationText("");
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkModerate(kind) {
    if (!selectedIds.size) return;

    if (kind === "reject") {
      setAction({ kind: "bulk-reject", count: selectedIds.size });
      setModerationText("");
      return;
    }

    bulkApprove();
  }

  async function bulkApprove() {
    setBulkBusy(true);
    setError("");

    try {
      await postJson("/admin/videos/bulk-approve", {
        videoIds: Array.from(selectedIds),
        comment: null,
      });

      setSelectedIds(new Set());
      await load();
    } catch (err) {
      setError(err.message || "Bulk approve failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function toggleFeatured(video) {
    if (!video) return;

    setFeaturedBusy(true);
    setError("");

    try {
      await postJson(`/admin/videos/${video._id}/featured`, {
        isFeatured: !video.isFeatured,
      });

      if (selected?._id === video._id) {
        const updated = await getRequest(`/admin/videos/${video._id}`);
        setSelectedDetail(updated);
      }

      await load();
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
      await load();
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
      await load();
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

  async function moderateVideo() {
    if (action?.kind === "bulk-reject") {
      if (moderationText.trim().length < 3) {
        setError("A rejection reason must contain at least 3 characters.");
        return;
      }

      setModerationBusy(true);
      setError("");

      try {
        await postJson("/admin/videos/bulk-reject", {
          videoIds: Array.from(selectedIds),
          reason: moderationText.trim(),
        });

        setAction(null);
        setModerationText("");
        setSelectedIds(new Set());
        await load();
      } catch (err) {
        setError(err.message || "Bulk reject failed.");
      } finally {
        setModerationBusy(false);
      }
      return;
    }

    if (!action?.video) return;

    const { kind, video } = action;

    if (kind === "reject" && moderationText.trim().length < 3) {
      setError("A rejection reason must contain at least 3 characters.");
      return;
    }

    setModerationBusy(true);
    setError("");

    try {
      if (kind === "approve") {
        await postJson(`/admin/videos/${video._id}/approve`, {
          comment: moderationText.trim() || null,
        });
      }

      if (kind === "reject") {
        await postJson(`/admin/videos/${video._id}/reject`, {
          reason: moderationText.trim(),
        });
      }

      if (kind === "reset") {
        await postEmpty(`/admin/videos/${video._id}/reset`);
      }

      setAction(null);
      setModerationText("");
      await load();

      if (selected?._id === video._id) {
        closeVideo();
      }
    } catch (err) {
      setError(err.message || "Moderation action failed.");
    } finally {
      setModerationBusy(false);
    }
  }

  const allVisibleSelected =
    filteredVideos.length > 0 &&
    filteredVideos.every((v) => selectedIds.has(v._id));

  return (
    <div>
      {/* Top Header & Studio Summary Ribbon */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#d9a653] animate-pulse" />
            <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[.2em] text-[#d9a653]">
              Cinema Catalogue Administration
            </p>
          </div>
          <h2 className="mt-1 font-[var(--font-display)] text-3xl text-[#efe7da]">
            All Videos
          </h2>
          <p className="mt-1 text-sm text-[#8b7c82]">
            Browse, inspect, and moderate submitted titles across the network.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.025] px-4 py-2.5 text-[10px] uppercase tracking-[.12em] text-[#d9d0d2] hover:bg-white/[0.06] hover:text-white disabled:opacity-50 transition"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh Catalogue
        </button>
      </div>

      {/* KPI Overview Tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          onClick={() => setStatus("all")}
          className={`cursor-pointer rounded-2xl border p-3.5 transition ${
            status === "all"
              ? "border-white/20 bg-white/[0.06]"
              : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"
          }`}
        >
          <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[#8b7c82]">
            Total Films
          </span>
          <p className="mt-1.5 font-[var(--font-display)] text-2xl text-[#efe7da]">
            {videos.length}
          </p>
        </div>

        <div
          onClick={() => setStatus("pending")}
          className={`cursor-pointer rounded-2xl border p-3.5 transition ${
            status === "pending"
              ? "border-[#d9a653]/50 bg-[#d9a653]/10"
              : "border-[#d9a653]/20 bg-[#d9a653]/[0.03] hover:border-[#d9a653]/40"
          }`}
        >
          <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[#d9a653]">
            Pending Queue
          </span>
          <p className="mt-1.5 font-[var(--font-display)] text-2xl text-[#d9a653]">
            {videos.filter((v) => v.moderationStatus === "pending").length}
          </p>
        </div>

        <div
          onClick={() => setStatus("approved")}
          className={`cursor-pointer rounded-2xl border p-3.5 transition ${
            status === "approved"
              ? "border-[#7fc59b]/50 bg-[#7fc59b]/10"
              : "border-[#7fc59b]/20 bg-[#7fc59b]/[0.03] hover:border-[#7fc59b]/40"
          }`}
        >
          <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[#7fc59b]">
            Approved & Live
          </span>
          <p className="mt-1.5 font-[var(--font-display)] text-2xl text-[#7fc59b]">
            {videos.filter((v) => v.moderationStatus === "approved").length}
          </p>
        </div>

        <div
          onClick={() => setStatus("rejected")}
          className={`cursor-pointer rounded-2xl border p-3.5 transition ${
            status === "rejected"
              ? "border-[#e08a6b]/50 bg-[#e08a6b]/10"
              : "border-[#e08a6b]/20 bg-[#e08a6b]/[0.03] hover:border-[#e08a6b]/40"
          }`}
        >
          <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[#e08a6b]">
            Rejected
          </span>
          <p className="mt-1.5 font-[var(--font-display)] text-2xl text-[#e08a6b]">
            {videos.filter((v) => v.moderationStatus === "rejected").length}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/[0.07] p-4 text-sm text-[#e08a6b]">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 focus-within:border-[#d9a653]/40 focus-within:bg-white/[0.04] transition">
          <Search size={15} className="text-[#71656a]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, director, language…"
            className="w-full bg-transparent py-2.5 text-xs text-[#efe7da] outline-none placeholder:text-[#71656a]"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-[#71656a] hover:text-[#d9d0d2]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/30 p-1">
          {[
            { id: "all", label: "All", count: videos.length },
            {
              id: "pending",
              label: "Pending",
              count: videos.filter((v) => v.moderationStatus === "pending").length,
              activeColor: "text-[#d9a653] bg-[#d9a653]/15 border-[#d9a653]/30",
            },
            {
              id: "approved",
              label: "Approved",
              count: videos.filter((v) => v.moderationStatus === "approved").length,
              activeColor: "text-[#7fc59b] bg-[#7fc59b]/15 border-[#7fc59b]/30",
            },
            {
              id: "rejected",
              label: "Rejected",
              count: videos.filter((v) => v.moderationStatus === "rejected").length,
              activeColor: "text-[#e08a6b] bg-[#e08a6b]/15 border-[#e08a6b]/30",
            },
          ].map((tab) => {
            const isActive = status === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatus(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-[var(--font-mono)] text-[10px] uppercase tracking-wider transition ${
                  isActive
                    ? tab.activeColor || "bg-white/[0.1] text-white border border-white/20"
                    : "text-[#8b7c82] hover:text-[#d9d0d2] hover:bg-white/[0.03]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-md px-1.5 py-0.2 text-[9px] ${
                    isActive ? "bg-black/40" : "bg-white/[0.06] text-[#71656a]"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            if (allVisibleSelected) {
              setSelectedIds(new Set());
            } else {
              setSelectedIds(new Set(filteredVideos.map((v) => v._id)));
            }
          }}
          className="whitespace-nowrap rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 font-[var(--font-mono)] text-[10px] uppercase tracking-[.1em] text-[#b8acb0] hover:bg-white/[0.06] hover:text-white transition"
        >
          {allVisibleSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-[#d9a653]/30 bg-[#d9a653]/[0.08] px-4 py-3 shadow-lg shadow-[#d9a653]/5">
          <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-[#d9a653]">
            {selectedIds.size} Video{selectedIds.size === 1 ? "" : "s"} Selected
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => bulkModerate("approve")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#d9a653] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#100d10] hover:brightness-110 disabled:opacity-50"
            >
              <Check size={12} />
              Approve All
            </button>

            <button
              onClick={() => bulkModerate("reject")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e08a6b]/30 bg-[#e08a6b]/10 px-3 py-1.5 text-[9px] uppercase tracking-wider text-[#e08a6b] hover:bg-[#e08a6b]/20 disabled:opacity-50"
            >
              <X size={12} />
              Reject All
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkBusy}
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[9px] uppercase tracking-wider text-[#b8acb0] hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Grid of Videos */}
      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="h-[280px] animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : filteredVideos.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredVideos.map((video) => (
            <FrameCard
              key={video._id}
              video={video}
              selected={selectedIds.has(video._id)}
              onToggleSelect={() => toggleSelect(video._id)}
              onOpen={() => openVideo(video)}
              onToggleFeatured={() => toggleFeatured(video)}
              featuredBusy={featuredBusy}
              onApprove={() => askModeration("approve", video)}
              onReject={() => askModeration("reject", video)}
              onReset={() => askModeration("reset", video)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-12 text-center">
          <FilmEmpty />
        </div>
      )}

      {/* Modern Studio Theater Video Modal (Optimized for standard laptop 100% zoom) */}
      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md"
          onClick={closeVideo}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative flex flex-col lg:flex-row w-full max-w-5xl max-h-[86vh] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#140f13] shadow-[0_25px_80px_rgba(0,0,0,0.85)]"
          >
            {/* Left Column: Video Screening Stage */}
            <div className="lg:w-[55%] flex flex-col bg-black/90 border-b lg:border-b-0 lg:border-r border-white/[0.08] relative">
              {/* Stage Top Bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.01]">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d9a653] animate-pulse" />
                  <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-[.2em] text-[#d9a653]">
                    Screening Player
                  </span>
                </div>
                <StatusBadge
                  status={selectedDetail?.moderationStatus || selected.moderationStatus}
                  size="sm"
                />
              </div>

              {/* Theater Video Player (Compact fit for 100% scale) */}
              <div className="relative flex-1 flex items-center justify-center p-3 sm:p-5 bg-gradient-to-b from-black via-[#0e0a0e] to-black min-h-[220px]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,166,83,0.06),transparent_70%)] pointer-events-none" />

                <div className="w-full max-w-[500px] relative z-10 shadow-2xl rounded-xl overflow-hidden border border-white/10">
                  {watchLoading ? (
                    <div className="grid aspect-video place-items-center bg-black">
                      <div className="flex items-center gap-2 text-xs text-[#8b7c82]">
                        <RefreshCw size={15} className="animate-spin text-[#d9a653]" />
                        <span>Loading stream…</span>
                      </div>
                    </div>
                  ) : watchData?.stream_url ? (
                    <AdminVideoPlayer
                      src={watchData.stream_url}
                      poster={selectedDetail?.thumbnailUrl || selected.thumbnailUrl}
                      title={selectedDetail?.title || selected.title}
                    />
                  ) : (
                    <div className="grid aspect-video place-items-center bg-black/80 p-4 text-center">
                      <p className="text-xs text-[#8b7c82]">
                        No stream available for preview.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Player Metadata Strip */}
              <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.015] flex flex-wrap items-center justify-between gap-2 font-[var(--font-mono)] text-[9px] text-[#71656a]">
                <div className="truncate max-w-[200px]">
                  ID: <span className="text-[#b8acb0]">{selected._id}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span>LANG: <strong className="text-[#b8acb0]">{selectedDetail?.language || selected.language || "—"}</strong></span>
                  <span>•</span>
                  <span>
                    {selectedDetail?.uploadedAt || selected.uploadedAt
                      ? new Date(selectedDetail?.uploadedAt || selected.uploadedAt).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Review Dossier & Inspector */}
            <div className="lg:w-[45%] flex flex-col bg-[#171216] max-h-[86vh]">
              {/* Sticky Header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-3.5 bg-[#171216]/95 backdrop-blur shrink-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-[var(--font-mono)] text-[8.5px] uppercase tracking-[.18em] text-[#d9a653]">
                      Review Dossier
                    </p>
                    {(selectedDetail?.ageRestricted ?? selected.ageRestricted) && (
                      <span className="rounded bg-[#e08a6b]/20 px-1.5 py-0.2 text-[8px] font-bold text-[#e08a6b]">
                        18+
                      </span>
                    )}
                    {(selectedDetail?.isFeatured ?? selected.isFeatured) && (
                      <span className="rounded bg-[#d9a653]/20 px-1.5 py-0.2 text-[8px] font-bold text-[#d9a653]">
                        FEATURED
                      </span>
                    )}
                  </div>

                  <h3
                    className="mt-0.5 truncate font-[var(--font-display)] text-lg sm:text-xl text-[#efe7da]"
                    title={selectedDetail?.title || selected.title}
                  >
                    {selectedDetail?.title || selected.title || "Untitled Video"}
                  </h3>
                </div>

                <button
                  onClick={closeVideo}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-[#b8acb0] hover:bg-white/[0.1] hover:text-white transition"
                  aria-label="Close video"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Scrollable Inspector Body with Custom Scrollbar */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/25"
                style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
              >
                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <p className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">Status</p>
                    <div className="mt-1">
                      <StatusBadge status={selectedDetail?.moderationStatus || selected.moderationStatus} size="sm" />
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <p className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">Language</p>
                    <p className="mt-1 text-xs font-medium text-[#efe7da] truncate">
                      {selectedDetail?.language || selected.language || "Not set"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <p className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">Uploaded</p>
                    <p className="mt-1 text-xs text-[#b8acb0] truncate">
                      {selectedDetail?.uploadedAt || selected.uploadedAt
                        ? new Date(selectedDetail?.uploadedAt || selected.uploadedAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">Description</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#b8acb0]">
                    {selectedDetail?.description || selected.description || "No description provided."}
                  </p>
                </div>

                {/* Tactile Toggle Controls: Age Restriction & Featured */}
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {/* Age Restriction Toggle Switch */}
                  <div
                    onClick={!ageBusy ? toggleAgeRestriction : undefined}
                    className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                      (selectedDetail?.ageRestricted ?? selected.ageRestricted)
                        ? "border-[#e08a6b]/40 bg-[#e08a6b]/[0.08]"
                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.15]"
                    } ${ageBusy ? "cursor-wait opacity-60" : ""}`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle
                          size={12}
                          className={
                            (selectedDetail?.ageRestricted ?? selected.ageRestricted)
                              ? "text-[#e08a6b]"
                              : "text-[#71656a]"
                          }
                        />
                        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#d9d0d2]">
                          Age Gate
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[#8b7c82]">
                        {(selectedDetail?.ageRestricted ?? selected.ageRestricted)
                          ? "18+ Restricted"
                          : "General Audience"}
                      </p>
                    </div>

                    <div
                      className={`relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                        (selectedDetail?.ageRestricted ?? selected.ageRestricted)
                          ? "bg-[#e08a6b]"
                          : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`h-3.5 w-3.5 transform rounded-full bg-[#100d10] shadow-md transition-transform ${
                          (selectedDetail?.ageRestricted ?? selected.ageRestricted)
                            ? "translate-x-3.5"
                            : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Featured Film Toggle Switch */}
                  <div
                    onClick={!featuredBusy ? () => toggleFeatured(selectedDetail || selected) : undefined}
                    className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                      (selectedDetail?.isFeatured ?? selected.isFeatured)
                        ? "border-[#d9a653]/40 bg-[#d9a653]/[0.08]"
                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.15]"
                    } ${featuredBusy ? "cursor-wait opacity-60" : ""}`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Star
                          size={12}
                          className={
                            (selectedDetail?.isFeatured ?? selected.isFeatured)
                              ? "text-[#d9a653]"
                              : "text-[#71656a]"
                          }
                          fill={(selectedDetail?.isFeatured ?? selected.isFeatured) ? "currentColor" : "none"}
                        />
                        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#d9d0d2]">
                          Featured
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[#8b7c82]">
                        {(selectedDetail?.isFeatured ?? selected.isFeatured)
                          ? "Promoted"
                          : "Standard"}
                      </p>
                    </div>

                    <div
                      className={`relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                        (selectedDetail?.isFeatured ?? selected.isFeatured)
                          ? "bg-[#d9a653]"
                          : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`h-3.5 w-3.5 transform rounded-full bg-[#100d10] shadow-md transition-transform ${
                          (selectedDetail?.isFeatured ?? selected.isFeatured)
                            ? "translate-x-3.5"
                            : "translate-x-0"
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

                  {/* Preset Badges */}
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

              {/* Sticky Action Footer */}
              <div className="p-3.5 border-t border-white/[0.08] bg-[#140f13]/95 backdrop-blur shrink-0 flex gap-2">
                {(selectedDetail?.moderationStatus || selected.moderationStatus) === "pending" ? (
                  <>
                    <button
                      disabled={moderationBusy}
                      onClick={() => askModeration("reject", selected)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/10 py-2.5 text-[9.5px] font-semibold uppercase tracking-wider text-[#e08a6b] hover:bg-[#e08a6b]/20 disabled:opacity-50 transition"
                    >
                      <X size={13} />
                      Reject Video
                    </button>

                    <button
                      disabled={moderationBusy}
                      onClick={() => askModeration("approve", selected)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#d9a653] py-2.5 text-[9.5px] font-semibold uppercase tracking-wider text-[#100d10] hover:brightness-110 disabled:opacity-50 shadow-md shadow-[#d9a653]/20 transition"
                    >
                      <Check size={13} />
                      Approve Video
                    </button>
                  </>
                ) : (
                  <button
                    disabled={moderationBusy}
                    onClick={() => askModeration("reset", selected)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-[9.5px] font-semibold uppercase tracking-wider text-[#b8acb0] hover:bg-white/[0.07] hover:text-white disabled:opacity-50 transition"
                  >
                    <RotateCcw size={13} />
                    Reset & Return to Review
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {action && (
        <ModerationDialog
          action={action}
          text={moderationText}
          setText={setModerationText}
          busy={moderationBusy}
          onConfirm={moderateVideo}
          onCancel={() => {
            if (!moderationBusy) {
              setAction(null);
              setModerationText("");
            }
          }}
        />
      )}
    </div>
  );
}

function FrameCard({
  video,
  selected,
  onToggleSelect,
  onOpen,
  onToggleFeatured,
  featuredBusy,
  onApprove,
  onReject,
  onReset,
}) {
  const meta = statusMeta(video.moderationStatus || "unknown");
  const isPending = video.moderationStatus === "pending";

  return (
    <article
      className={`group overflow-hidden rounded-2xl border bg-white/[0.02] transition duration-200 hover:border-white/20 hover:bg-white/[0.035] ${
        selected
          ? "border-[#d9a653]/60 shadow-[0_0_0_1px_rgba(217,166,83,.35)]"
          : "border-white/[0.08]"
      }`}
    >
      <div className="relative">
        <button
          onClick={onOpen}
          className="block w-full cursor-pointer focus:outline-none"
          aria-label={`Open ${video.title || "video"}`}
        >
          <img
            src={video.thumbnailUrl || ""}
            alt=""
            className="aspect-video w-full bg-black object-cover transition duration-300 group-hover:scale-[1.02] group-hover:brightness-105"
          />
        </button>

        {/* HUD corner brackets */}
        <span className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 border-l border-t border-[#d9a653]/60" />
        <span className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 border-r border-t border-[#d9a653]/60" />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 h-3.5 w-3.5 border-b border-l border-[#d9a653]/60" />
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 h-3.5 w-3.5 border-b border-r border-[#d9a653]/60" />

        {/* Play Overlay */}
        <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100 bg-black/30 backdrop-blur-[1px]">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/80 border border-[#d9a653]/40 text-[#d9a653] shadow-lg">
            <Play size={15} fill="currentColor" />
          </span>
        </span>

        {/* Selection Checkbox */}
        <button
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect();
          }}
          className={`absolute left-3 top-3 grid h-6 w-6 place-items-center rounded-md border text-[10px] font-bold backdrop-blur transition ${
            selected
              ? "border-[#d9a653] bg-[#d9a653] text-[#100d10]"
              : "border-white/30 bg-black/50 text-transparent hover:border-white/60"
          }`}
          aria-label={selected ? "Deselect" : "Select"}
        >
          {selected ? "✓" : ""}
        </button>

        {/* Featured Toggle Star */}
        <button
          onClick={(event) => {
            event.stopPropagation();
            onToggleFeatured();
          }}
          disabled={featuredBusy}
          className={`absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-md border backdrop-blur transition disabled:opacity-50 ${
            video.isFeatured
              ? "border-[#d9a653] bg-[#d9a653] text-[#100d10]"
              : "border-white/30 bg-black/50 text-[#d9a653] hover:border-white/60"
          }`}
          aria-label="Toggle featured"
        >
          <Star size={12} fill={video.isFeatured ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-xs font-medium text-[#e5dcde]">
            {video.title || "Untitled video"}
          </h3>
          <StatusBadge status={video.moderationStatus} size="sm" />
        </div>

        <div className="mt-2 flex items-center gap-2 font-[var(--font-mono)] text-[9px] uppercase tracking-[.1em] text-[#71656a]">
          <span>
            {video.uploadedAt
              ? new Date(video.uploadedAt).toLocaleDateString()
              : "—"}
          </span>
          <span>/</span>
          <span>{shortId(video.directorId)}</span>
        </div>

        <div className="mt-3.5 flex gap-2">
          {isPending ? (
            <>
              <button
                onClick={onApprove}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#d9a653] py-2 text-[9px] font-semibold uppercase tracking-wider text-[#100d10] hover:brightness-110 transition"
              >
                <Check size={12} />
                Approve
              </button>

              <button
                onClick={onReject}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#e08a6b]/30 bg-[#e08a6b]/5 py-2 text-[9px] uppercase tracking-wider text-[#e08a6b] hover:bg-[#e08a6b]/15 transition"
              >
                <X size={12} />
                Reject
              </button>
            </>
          ) : (
            <button
              onClick={onReset}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] py-2 text-[9px] uppercase tracking-wider text-[#b8acb0] hover:bg-white/[0.06] hover:text-white transition"
            >
              <RotateCcw size={12} />
              Reset Review
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function FilmEmpty() {
  return (
    <div>
      <p className="text-sm text-[#71656a]">
        No videos match the current search or status filter.
      </p>
      <p className="mt-2 text-[10px] text-[#51494d]">
        Try adjusting your filter or search query.
      </p>
    </div>
  );
}

function ModerationDialog({
  action,
  text,
  setText,
  busy,
  onConfirm,
  onCancel,
}) {
  const isApprove = action.kind === "approve";
  const isReject = action.kind === "reject" || action.kind === "bulk-reject";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#171216] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] uppercase tracking-[.18em] text-[#d9a653]">
              Moderation Decision
            </p>
            <h3 className="mt-1 font-[var(--font-display)] text-xl text-[#efe7da]">
              {isApprove
                ? "Approve Video"
                : action.kind === "bulk-reject"
                  ? "Reject Selected Videos"
                  : isReject
                    ? "Reject Video"
                    : "Reset Video to Review"}
            </h3>
          </div>

          <button
            onClick={onCancel}
            disabled={busy}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04] text-[#b8acb0] hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        <p className="mt-2 text-xs text-[#8b7c82]">
          {action.kind === "bulk-reject"
            ? `${action.count} selected video${action.count === 1 ? "" : "s"}`
            : action.video?.title || "Selected video"}
        </p>

        {isApprove && (
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Optional approval note for internal records…"
            className="mt-4 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/40"
          />
        )}

        {isReject && (
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Enter reason for rejection (required, min 3 characters)…"
            className="mt-4 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-[#efe7da] outline-none focus:border-[#e08a6b]/40"
          />
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-[10px] uppercase tracking-[.1em] text-[#b8acb0] hover:text-white"
          >
            Cancel
          </button>

          <button
            disabled={busy || (isReject && text.trim().length < 3)}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[.1em] disabled:opacity-40 transition ${
              isReject
                ? "bg-[#e08a6b] text-[#100d10] hover:brightness-110"
                : "bg-[#d9a653] text-[#100d10] hover:brightness-110"
            }`}
          >
            {busy
              ? "Processing…"
              : isApprove
                ? "Approve"
                : isReject
                  ? "Reject"
                  : "Reset"}
          </button>
        </div>
      </div>
    </div>
  );
}