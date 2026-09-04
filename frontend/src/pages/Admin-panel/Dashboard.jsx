import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  CheckCircle2,
  Film,
  MessageSquareWarning,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { getRequest } from "../../api/client.js";

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
      <div className="flex items-start justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[.16em] text-[#71656a]">
          {label}
        </span>

        <Icon
          size={17}
          className="text-[#d9a653]"
        />
      </div>

      <strong className="mt-4 block font-[var(--font-display)] text-3xl font-medium text-[#efe7da]">
        {value}
      </strong>
    </div>
  );
}

function getVideos(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.videos)) return data.videos;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function getCommentCount(data) {
  if (typeof data?.count === "number") {
    return data.count;
  }

  if (Array.isArray(data?.comments)) {
    return data.comments.length;
  }

  return 0;
}

export default function Dashboard() {
  const [videos, setVideos] = useState([]);
  const [flaggedComments, setFlaggedComments] =
    useState(0);

  const [videoLoading, setVideoLoading] =
    useState(true);

  const [commentLoading, setCommentLoading] =
    useState(true);

  const [videoError, setVideoError] = useState("");
  const [commentError, setCommentError] = useState("");

  async function loadVideos() {
    setVideoLoading(true);
    setVideoError("");

    try {
      const data = await getRequest("/admin/videos");
      setVideos(getVideos(data));
    } catch (error) {
      setVideoError(
        error.message || "Unable to load videos."
      );
      setVideos([]);
    } finally {
      setVideoLoading(false);
    }
  }

  async function loadComments() {
    setCommentLoading(true);
    setCommentError("");

    try {
      const data = await getRequest(
        "/admin/comments/flagged"
      );

      setFlaggedComments(getCommentCount(data));
    } catch (error) {
      setCommentError(
        error.message ||
          "Unable to load flagged comments."
      );
      setFlaggedComments(0);
    } finally {
      setCommentLoading(false);
    }
  }

  async function load() {
    await Promise.all([
      loadVideos(),
      loadComments(),
    ]);
  }

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    return videos.reduce((result, video) => {
      const status =
        video.moderationStatus || "unknown";

      result[status] =
        (result[status] || 0) + 1;

      return result;
    }, {});
  }, [videos]);

  const recent = useMemo(() => {
    return [...videos]
      .sort(
        (a, b) =>
          new Date(b.uploadedAt || 0) -
          new Date(a.uploadedAt || 0)
      )
      .slice(0, 5);
  }, [videos]);

  const loading = videoLoading || commentLoading;

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[9px] uppercase tracking-[.2em] text-[#d9a653]">
            Command center
          </p>

          <h2 className="font-[var(--font-display)] text-3xl text-[#efe7da] sm:text-4xl">
            Good morning, Admin
          </h2>

          <p className="mt-2 text-sm text-[#8b7c82]">
            Monitor and moderate the real
            Proscenium content system.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-white/[0.1] bg-white/[0.035] px-4 py-2.5 text-[10px] uppercase tracking-[.12em] text-[#d9d0d2] hover:border-[#d9a653]/40 disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={
              loading ? "animate-spin" : ""
            }
          />
          Refresh
        </button>
      </div>

      {videoError && (
        <div className="mb-4 rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/[0.07] p-4 text-sm text-[#e08a6b]">
          Videos: {videoError}
        </div>
      )}

      {commentError && (
        <div className="mb-5 rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/[0.07] p-4 text-sm text-[#e08a6b]">
          Comments: {commentError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Total videos"
          value={
            videoLoading ? "—" : videos.length
          }
          icon={Film}
        />

        <Stat
          label="Pending review"
          value={
            videoLoading
              ? "—"
              : counts.pending || 0
          }
          icon={ShieldAlert}
        />

        <Stat
          label="Approved"
          value={
            videoLoading
              ? "—"
              : counts.approved || 0
          }
          icon={CheckCircle2}
        />

        <Stat
          label="Rejected"
          value={
            videoLoading
              ? "—"
              : counts.rejected || 0
          }
          icon={Activity}
        />

        <Stat
          label="Flagged comments"
          value={
            commentLoading
              ? "—"
              : flaggedComments
          }
          icon={MessageSquareWarning}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="mb-5">
            <h3 className="font-[var(--font-display)] text-xl">
              Recent content
            </h3>

            <p className="mt-1 text-xs text-[#71656a]">
              Latest videos returned by the real
              admin video endpoint.
            </p>
          </div>

          {videoLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-14 animate-pulse rounded-xl bg-white/[0.04]"
                />
              ))}
            </div>
          ) : recent.length ? (
            <div className="divide-y divide-white/[0.06]">
              {recent.map((video) => (
                <div
                  key={video._id}
                  className="flex items-center gap-3 py-3"
                >
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    className="h-12 w-20 rounded-lg bg-white/[0.04] object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[#e5dcde]">
                      {video.title ||
                        "Untitled video"}
                    </p>

                    <p className="mt-1 text-[9px] uppercase tracking-[.12em] text-[#71656a]">
                      {video.moderationStatus ||
                        "unknown"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[#71656a]">
              No videos returned by the backend.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <h3 className="font-[var(--font-display)] text-xl">
            Moderation snapshot
          </h3>

          <div className="mt-5 space-y-4">
            {[
              [
                "Pending",
                counts.pending || 0,
                "bg-[#d9a653]",
              ],
              [
                "Approved",
                counts.approved || 0,
                "bg-[#7fc59b]",
              ],
              [
                "Rejected",
                counts.rejected || 0,
                "bg-[#e08a6b]",
              ],
            ].map(([name, value, bar]) => (
              <div key={name}>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-[#a99da1]">
                    {name}
                  </span>

                  <b>{value}</b>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full ${bar}`}
                    style={{
                      width: videos.length
                        ? `${Math.min(
                            100,
                            (value /
                              videos.length) *
                              100
                          )}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}