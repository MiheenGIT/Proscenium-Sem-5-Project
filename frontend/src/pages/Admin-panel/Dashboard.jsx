import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Film,
  MessageSquareWarning,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getRequest } from "../../api/client.js";

function getVideos(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.videos)) return data.videos;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function getCommentCount(data) {
  if (typeof data?.count === "number") return data.count;
  if (Array.isArray(data?.comments)) return data.comments.length;
  return 0;
}

const STATUS_META = {
  approved: {
    label: "Approved",
    dot: "bg-[#7fc59b]",
    text: "text-[#7fc59b]",
    bg: "bg-[#7fc59b]/10",
    border: "border-[#7fc59b]/30",
  },
  rejected: {
    label: "Rejected",
    dot: "bg-[#e08a6b]",
    text: "text-[#e08a6b]",
    bg: "bg-[#e08a6b]/10",
    border: "border-[#e08a6b]/30",
  },
  pending: {
    label: "Pending",
    dot: "bg-[#d9a653]",
    text: "text-[#d9a653]",
    bg: "bg-[#d9a653]/10",
    border: "border-[#d9a653]/30",
  },
  unknown: {
    label: "Unknown",
    dot: "bg-[#a99da1]",
    text: "text-[#a99da1]",
    bg: "bg-white/[0.05]",
    border: "border-white/10",
  },
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-[var(--font-mono)] text-[8.5px] uppercase tracking-wider ${meta.bg} ${meta.text} ${meta.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} animate-pulse`} />
      {meta.label}
    </span>
  );
}

function StatCard({ label, value, subtext, icon: Icon, accent = "gold", loading }) {
  const accents = {
    gold: {
      text: "text-[#d9a653]",
      border: "hover:border-[#d9a653]/40",
      bg: "bg-[#d9a653]/[0.05]",
    },
    green: {
      text: "text-[#7fc59b]",
      border: "hover:border-[#7fc59b]/40",
      bg: "bg-[#7fc59b]/[0.05]",
    },
    red: {
      text: "text-[#e08a6b]",
      border: "hover:border-[#e08a6b]/40",
      bg: "bg-[#e08a6b]/[0.05]",
    },
    neutral: {
      text: "text-[#d9d0d2]",
      border: "hover:border-white/20",
      bg: "bg-white/[0.02]",
    },
  };

  const theme = accents[accent] || accents.gold;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition duration-200 ${theme.border} hover:bg-white/[0.035]`}
    >
      <div className="flex items-start justify-between">
        <span className="font-[var(--font-mono)] text-[9px] font-semibold uppercase tracking-[.18em] text-[#71656a]">
          {label}
        </span>
        <div className={`grid h-8 w-8 place-items-center rounded-xl border border-white/[0.08] ${theme.bg}`}>
          <Icon size={16} className={theme.text} />
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded-lg bg-white/[0.06]" />
        ) : (
          <strong className="font-[var(--font-display)] text-3xl font-medium text-[#efe7da]">
            {value}
          </strong>
        )}
        {subtext && (
          <p className="mt-1 text-[11px] text-[#8b7c82]">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [videos, setVideos] = useState([]);
  const [flaggedComments, setFlaggedComments] = useState(0);

  const [videoLoading, setVideoLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(true);

  const [videoError, setVideoError] = useState("");
  const [commentError, setCommentError] = useState("");

  async function loadVideos() {
    setVideoLoading(true);
    setVideoError("");
    try {
      const data = await getRequest("/admin/videos");
      setVideos(getVideos(data));
    } catch (error) {
      setVideoError(error.message || "Unable to load videos.");
      setVideos([]);
    } finally {
      setVideoLoading(false);
    }
  }

  async function loadComments() {
    setCommentLoading(true);
    setCommentError("");
    try {
      const data = await getRequest("/admin/comments/flagged");
      setFlaggedComments(getCommentCount(data));
    } catch (error) {
      setCommentError(error.message || "Unable to load flagged comments.");
      setFlaggedComments(0);
    } finally {
      setCommentLoading(false);
    }
  }

  async function load() {
    await Promise.all([loadVideos(), loadComments()]);
  }

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    return videos.reduce((result, video) => {
      const status = video.moderationStatus || "unknown";
      result[status] = (result[status] || 0) + 1;
      return result;
    }, {});
  }, [videos]);

  const recent = useMemo(() => {
    return [...videos]
      .sort(
        (a, b) =>
          new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
      )
      .slice(0, 5);
  }, [videos]);

  const loading = videoLoading || commentLoading;
  const pendingCount = counts.pending || 0;
  const approvedCount = counts.approved || 0;
  const rejectedCount = counts.rejected || 0;

  return (
    <div className="space-y-6">
      {/* Header & Command Center Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#d9a653] animate-pulse" />
            <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[.2em] text-[#d9a653]">
              Proscenium Studio • Command Center
            </p>
          </div>
          <h2 className="mt-1 font-[var(--font-display)] text-3xl text-[#efe7da] sm:text-4xl">
            Executive Overview
          </h2>
          <p className="mt-1 text-sm text-[#8b7c82]">
            Real-time catalog monitoring, upload intake, and moderation performance.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.025] px-4 py-2.5 font-[var(--font-mono)] text-[10px] uppercase tracking-[.12em] text-[#d9d0d2] hover:border-[#d9a653]/40 hover:bg-white/[0.05] hover:text-white disabled:opacity-50 transition"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Sync Data
        </button>
      </div>

      {/* Priority Action Banner (If queue has items) */}
      {!loading && (pendingCount > 0 || flaggedComments > 0) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#d9a653]/30 bg-[#d9a653]/[0.08] p-4 shadow-lg shadow-[#d9a653]/5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#d9a653]/20 text-[#d9a653]">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#efe7da]">
                Moderator Attention Required
              </p>
              <p className="text-[11px] text-[#b8acb0]">
                {pendingCount > 0 && `${pendingCount} film${pendingCount === 1 ? "" : "s"} waiting for screening approval`}
                {pendingCount > 0 && flaggedComments > 0 && " • "}
                {flaggedComments > 0 && `${flaggedComments} user comment${flaggedComments === 1 ? "" : "s"} flagged`}
              </p>
            </div>
          </div>

          <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[#d9a653]">
            Action recommended
          </span>
        </div>
      )}

      {/* Error Notices */}
      {videoError && (
        <div className="rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/[0.07] p-4 text-sm text-[#e08a6b]">
          Video Catalog Error: {videoError}
        </div>
      )}

      {commentError && (
        <div className="rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/[0.07] p-4 text-sm text-[#e08a6b]">
          Comments Feed Error: {commentError}
        </div>
      )}

      {/* 5 Top KPI Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total Catalog"
          value={videoLoading ? "—" : videos.length}
          subtext="Indexed film titles"
          icon={Film}
          accent="neutral"
          loading={videoLoading}
        />

        <StatCard
          label="Pending Review"
          value={videoLoading ? "—" : pendingCount}
          subtext={videos.length ? `${Math.round((pendingCount / videos.length) * 100)}% of total` : "Empty queue"}
          icon={ShieldAlert}
          accent="gold"
          loading={videoLoading}
        />

        <StatCard
          label="Approved & Live"
          value={videoLoading ? "—" : approvedCount}
          subtext={videos.length ? `${Math.round((approvedCount / videos.length) * 100)}% approval rate` : "Active titles"}
          icon={CheckCircle2}
          accent="green"
          loading={videoLoading}
        />

        <StatCard
          label="Rejected"
          value={videoLoading ? "—" : rejectedCount}
          subtext="Returned to director"
          icon={Activity}
          accent="red"
          loading={videoLoading}
        />

        <StatCard
          label="Flagged Comments"
          value={commentLoading ? "—" : flaggedComments}
          subtext={flaggedComments > 0 ? "Needs triage" : "Community clear"}
          icon={MessageSquareWarning}
          accent={flaggedComments > 0 ? "red" : "neutral"}
          loading={commentLoading}
        />
      </div>

      {/* Main 2-Column Section */}
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* Left Column: Recent Intake & Stream */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
            <div>
              <h3 className="font-[var(--font-display)] text-xl text-[#efe7da]">
                Recent Submissions
              </h3>
              <p className="mt-0.5 text-xs text-[#71656a]">
                Latest uploads ingested into the Proscenium pipeline
              </p>
            </div>
            <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[#71656a]">
              Last 5 Titles
            </span>
          </div>

          {videoLoading ? (
            <div className="space-y-3 pt-4">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-xl border border-white/[0.04] bg-white/[0.02]"
                />
              ))}
            </div>
          ) : recent.length ? (
            <div className="divide-y divide-white/[0.05]">
              {recent.map((video) => (
                <div
                  key={video._id}
                  className="group flex items-center justify-between gap-4 py-3.5 transition hover:bg-white/[0.015] px-2 rounded-xl"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Thumbnail Preview with HUD Brackets */}
                    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-black border border-white/10">
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <span className="pointer-events-none absolute left-1 top-1 h-2 w-2 border-l border-t border-[#d9a653]/60" />
                      <span className="pointer-events-none absolute right-1 bottom-1 h-2 w-2 border-r border-b border-[#d9a653]/60" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#e5dcde] group-hover:text-[#efe7da]">
                        {video.title || "Untitled video"}
                      </p>
                      <div className="mt-1 flex items-center gap-2 font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[#71656a]">
                        <span>
                          {video.uploadedAt
                            ? new Date(video.uploadedAt).toLocaleDateString()
                            : "—"}
                        </span>
                        <span>/</span>
                        <span>
                          {video.directorId ? `DIR: ${String(video.directorId).slice(-6)}` : "DIR: —"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <StatusPill status={video.moderationStatus} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Film size={28} className="mx-auto text-[#71656a]/60" />
              <p className="mt-2 text-xs text-[#71656a]">No video records found in catalog.</p>
            </div>
          )}
        </section>

        {/* Right Column: Moderation Snapshot & Health Breakdown */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-white/[0.06]">
              <h3 className="font-[var(--font-display)] text-xl text-[#efe7da]">
                Catalogue Distribution
              </h3>
              <p className="mt-0.5 text-xs text-[#71656a]">
                Proportional breakdown of current video library
              </p>
            </div>

            {/* Visual Multi-Segment Bar */}
            <div className="mt-5">
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.06] flex p-0.5 gap-0.5">
                {videos.length > 0 ? (
                  <>
                    <div
                      title={`Approved: ${approvedCount}`}
                      className="h-full rounded-l-full bg-[#7fc59b] transition-all duration-500"
                      style={{ width: `${(approvedCount / videos.length) * 100}%` }}
                    />
                    <div
                      title={`Pending: ${pendingCount}`}
                      className="h-full bg-[#d9a653] transition-all duration-500"
                      style={{ width: `${(pendingCount / videos.length) * 100}%` }}
                    />
                    <div
                      title={`Rejected: ${rejectedCount}`}
                      className="h-full rounded-r-full bg-[#e08a6b] transition-all duration-500"
                      style={{ width: `${(rejectedCount / videos.length) * 100}%` }}
                    />
                  </>
                ) : (
                  <div className="h-full w-full bg-white/10 rounded-full" />
                )}
              </div>

              {/* Breakdown Legend */}
              <div className="mt-6 space-y-4">
                {[
                  {
                    name: "Approved (Public)",
                    count: approvedCount,
                    color: "bg-[#7fc59b]",
                    textColor: "text-[#7fc59b]",
                    percentage: videos.length ? Math.round((approvedCount / videos.length) * 100) : 0,
                  },
                  {
                    name: "Pending Review",
                    count: pendingCount,
                    color: "bg-[#d9a653]",
                    textColor: "text-[#d9a653]",
                    percentage: videos.length ? Math.round((pendingCount / videos.length) * 100) : 0,
                  },
                  {
                    name: "Rejected",
                    count: rejectedCount,
                    color: "bg-[#e08a6b]",
                    textColor: "text-[#e08a6b]",
                    percentage: videos.length ? Math.round((rejectedCount / videos.length) * 100) : 0,
                  },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 rounded-full ${item.color}`} />
                      <span className="text-[#b8acb0]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-[var(--font-mono)]">
                      <span className="text-xs font-semibold text-[#efe7da]">{item.count}</span>
                      <span className="text-[10px] text-[#71656a]">({item.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick System Integrity Note */}
          <div className="mt-8 pt-4 border-t border-white/[0.06] flex items-center justify-between font-[var(--font-mono)] text-[9px] text-[#71656a]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-[#7fc59b]" />
              Moderation Pipeline Online
            </span>
            <span>REST API Active</span>
          </div>
        </section>
      </div>
    </div>
  );
}