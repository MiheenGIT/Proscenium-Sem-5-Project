import React, {
  useEffect,
  useState,
} from "react";
import {
  Check,
  Play,
  RefreshCw,
  X,
} from "lucide-react";
import {
  getRequest,
  postJson,
} from "../../api/client.js";
import AdminVideoPlayer from "../../components/admin/AdminVideoPlayer.jsx";

export default function Review() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] =
    useState(null);

  const [watchData, setWatchData] =
    useState(null);

  const [watchLoading, setWatchLoading] =
    useState(false);

  const [comment, setComment] =
    useState("");

  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await getRequest(
        "/admin/videos?status=pending"
      );

      setVideos(
        Array.isArray(data?.videos)
          ? data.videos
          : []
      );
    } catch (err) {
      setVideos([]);
      setError(
        err.message ||
          "Unable to load review queue."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openReview(video) {
    setSelected(video);
    setWatchData(null);
    setComment("");
    setWatchLoading(true);
    setError("");

    try {
      const data = await getRequest(
        `/admin/videos/${video._id}/watch`
      );

      setWatchData(data);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load video stream."
      );
    } finally {
      setWatchLoading(false);
    }
  }

  async function moderate(kind) {
    if (!selected) return;

    if (
      kind === "reject" &&
      comment.trim().length < 3
    ) {
      setError(
        "Please provide a rejection reason."
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (kind === "approve") {
        await postJson(
          `/admin/videos/${selected._id}/approve`,
          {
            comment:
              comment.trim() || null,
          }
        );
      } else {
        await postJson(
          `/admin/videos/${selected._id}/reject`,
          {
            reason: comment.trim(),
          }
        );
      }

      setSelected(null);
      setWatchData(null);
      setComment("");

      await load();
    } catch (err) {
      setError(
        err.message || "Moderation failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[.2em] text-[#d9a653]">
            Moderation
          </p>

          <h2 className="mt-2 font-[var(--font-display)] text-3xl">
            Review queue
          </h2>

          <p className="mt-2 text-sm text-[#8b7c82]">
            Review pending films before publishing
            them to viewers.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2.5 text-[10px] uppercase tracking-[.12em] disabled:opacity-50"
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

      {error && (
        <div className="mb-4 rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/[0.07] p-4 text-sm text-[#e08a6b]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-80 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : videos.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => (
            <article
              key={video._id}
              className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]"
            >
              <div className="relative">
                <img
                  src={video.thumbnailUrl || ""}
                  alt=""
                  className="aspect-video w-full bg-black object-cover"
                />

                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-black/70 text-[#d9a653]">
                    <Play
                      size={18}
                      fill="currentColor"
                    />
                  </span>
                </span>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-[var(--font-display)] text-lg">
                      {video.title ||
                        "Untitled video"}
                    </h3>

                    <p className="mt-1 text-[10px] text-[#71656a]">
                      {video.uploadedAt
                        ? new Date(
                            video.uploadedAt
                          ).toLocaleString()
                        : "Upload date unavailable"}
                    </p>
                  </div>

                  <span className="rounded-full border border-[#d9a653]/25 px-2 py-1 text-[8px] uppercase tracking-[.08em] text-[#d9a653]">
                    Pending
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#8b7c82]">
                  {video.description ||
                    "No description supplied."}
                </p>

                <button
                  onClick={() =>
                    openReview(video)
                  }
                  className="mt-4 w-full rounded-xl border border-white/[0.09] px-3 py-2.5 text-[9px] uppercase tracking-[.1em] text-[#b8acb0] hover:border-[#d9a653]/40"
                >
                  <Play
                    size={13}
                    className="mr-1 inline"
                  />
                  Watch & Review
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] p-12 text-center">
          <p className="text-sm text-[#71656a]">
            The review queue is empty.
          </p>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!busy) {
              setSelected(null);
              setWatchData(null);
            }
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#171216] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
              <div>
                <p className="text-[9px] uppercase tracking-[.18em] text-[#d9a653]">
                  Film review
                </p>

                <h3 className="mt-2 font-[var(--font-display)] text-2xl">
                  {selected.title}
                </h3>
              </div>

              <button
                disabled={busy}
                onClick={() => {
                  setSelected(null);
                  setWatchData(null);
                }}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.04]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              {watchLoading ? (
                <div className="grid aspect-video place-items-center rounded-2xl bg-black">
                  <RefreshCw
                    size={20}
                    className="animate-spin text-[#d9a653]"
                  />
                </div>
              ) : watchData?.stream_url ? (
                <AdminVideoPlayer
                  src={watchData.stream_url}
                  poster={selected.thumbnailUrl}
                  title={selected.title}
                />
              ) : (
                <div className="grid aspect-video place-items-center rounded-2xl bg-black">
                  <p className="text-sm text-[#8b7c82]">
                    The backend did not return a
                    stream URL.
                  </p>
                </div>
              )}

              <div className="mt-5 rounded-xl bg-white/[0.03] p-4">
                <p className="text-[9px] uppercase tracking-[.12em] text-[#71656a]">
                  Description
                </p>

                <p className="mt-2 text-sm leading-relaxed text-[#b8acb0]">
                  {selected.description ||
                    "No description supplied."}
                </p>
              </div>

              <div className="mt-5">
                <label className="text-[9px] uppercase tracking-[.14em] text-[#71656a]">
                  Moderator note
                </label>

                <textarea
                  value={comment}
                  onChange={(event) =>
                    setComment(
                      event.target.value
                    )
                  }
                  maxLength={500}
                  rows={4}
                  placeholder="Optional approval note or required rejection reason…"
                  className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/40"
                />
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  disabled={
                    busy ||
                    comment.trim().length < 3
                  }
                  onClick={() =>
                    moderate("reject")
                  }
                  className="flex-1 rounded-xl border border-[#e08a6b]/30 px-4 py-3 text-[10px] uppercase tracking-[.1em] text-[#e08a6b] disabled:opacity-40"
                >
                  <X
                    size={14}
                    className="mr-1 inline"
                  />
                  Reject
                </button>

                <button
                  disabled={busy}
                  onClick={() =>
                    moderate("approve")
                  }
                  className="flex-1 rounded-xl bg-[#d9a653] px-4 py-3 text-[10px] font-semibold uppercase tracking-[.1em] text-[#100d10] disabled:opacity-50"
                >
                  <Check
                    size={14}
                    className="mr-1 inline"
                  />
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}