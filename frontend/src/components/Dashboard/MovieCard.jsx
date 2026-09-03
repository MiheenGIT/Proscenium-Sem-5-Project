import React, { useEffect, useState } from "react";
import {Bookmark,Check,Heart,Play,Star,} from "lucide-react";
import { postJson } from "../../api/client.js";

const num = (value) => Number(value || 0);

function year(video) {
  if (video?.releaseYear) {
    return video.releaseYear;
  }

  if (video?.publishedAt) {
    const date = new Date(video.publishedAt);

    if (!Number.isNaN(date.getTime())) {
      return date.getFullYear();
    }
  }

  return "";
}

function progressPercent(video) {
  const direct = num(video?.progress);

  if (direct > 0) {
    return Math.min(100, Math.round(direct));
  }

  const duration = num(video?.durationSec);
  const current = num(video?.currentTimeSec);

  if (!duration || !current) {
    return 0;
  }

  return Math.min(
    100,
    Math.round((current / duration) * 100)
  );
}

function Thumbnail({ video }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [video?.thumbnailUrl]);

  if (!video?.thumbnailUrl || failed) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,#38202b_0%,#21151c_45%,#120f12_100%)]">
        <div className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-black/20 text-[#8f8288]">
          <Play size={20} />
        </div>

        <span className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[7px] uppercase tracking-[.16em] text-[#9c9094]">
          Proscenium
        </span>
      </div>
    );
  }

  return (
    <img
      src={video.thumbnailUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
    />
  );
}

export default function MovieCard({
  video,
  saved = false,
  liked = false,
  onSaved,
  onLiked,
  onPlay,
  compact = false,
}) {
  const [busy, setBusy] = useState(false);
  const [localSaved, setLocalSaved] = useState(saved);
  const [localLiked, setLocalLiked] = useState(liked);

  useEffect(() => {
    setLocalSaved(saved);
  }, [saved]);

  useEffect(() => {
    setLocalLiked(liked);
  }, [liked]);

  const progress = progressPercent(video);

  async function toggleSave(event) {
    event.stopPropagation();

    if (busy || !video?.id) return;

    setBusy(true);

    const next = !localSaved;

    setLocalSaved(next);

    try {
      const result = await postJson(
        `/viewer/videos/${video.id}/watchlist`,
        {
          saved: next,
        }
      );

      const actual = Boolean(result?.saved);

      setLocalSaved(actual);
      onSaved?.(video.id, actual);
    } catch {
      setLocalSaved(!next);
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike(event) {
    event.stopPropagation();

    if (busy || !video?.id) return;

    setBusy(true);

    const next = !localLiked;

    setLocalLiked(next);

    try {
      const result = await postJson(
        `/viewer/videos/${video.id}/react`,
        {
          type: "like",
        }
      );

      const actual =
        result?.reaction === "like";

      setLocalLiked(actual);
      onLiked?.(video.id, actual);
    } catch {
      setLocalLiked(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={`group shrink-0 ${
        compact
          ? "w-[150px] sm:w-[170px]"
          : "w-[185px] sm:w-[210px] lg:w-[220px]"
      }`}
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#171216] shadow-[0_18px_55px_rgba(0,0,0,.22)] transition duration-300 group-hover:-translate-y-1 group-hover:border-[#d9a653]/35 group-hover:shadow-[0_22px_65px_rgba(0,0,0,.38)]">
        <div className="relative aspect-[16/10] w-full overflow-hidden">
          <button
            type="button"
            onClick={() => onPlay?.(video)}
            className="absolute inset-0 z-10 block h-full w-full text-left"
            aria-label={`Play ${video?.title || "film"}`}
          >
            <Thumbnail video={video} />

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />

            <span className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center rounded-full bg-[#efe7da] text-[#100d10] opacity-0 shadow-xl transition group-hover:opacity-100">
              <Play
                size={15}
                fill="currentColor"
              />
            </span>

            {progress > 0 && (
              <span className="absolute bottom-0 left-0 h-1 w-full bg-white/15">
                <i
                  className="block h-full bg-[#d9a653]"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </span>
            )}
          </button>

          <div className="absolute right-2.5 top-2.5 z-20 flex gap-1.5">
            <button
              type="button"
              onClick={toggleLike}
              disabled={busy}
              className={`grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/60 backdrop-blur transition ${
                localLiked
                  ? "text-[#d9a653]"
                  : "text-[#efe7da]"
              }`}
              aria-label={
                localLiked ? "Unlike" : "Like"
              }
            >
              <Heart
                size={14}
                fill={
                  localLiked
                    ? "currentColor"
                    : "none"
                }
              />
            </button>

            <button
              type="button"
              onClick={toggleSave}
              disabled={busy}
              className={`grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/60 backdrop-blur transition ${
                localSaved
                  ? "text-[#d9a653]"
                  : "text-[#efe7da]"
              }`}
              aria-label={
                localSaved
                  ? "Remove from watchlist"
                  : "Add to watchlist"
              }
            >
              {localSaved ? (
                <Check size={14} />
              ) : (
                <Bookmark size={14} />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="px-1 pt-3">
        <button
          type="button"
          onClick={() => onPlay?.(video)}
          className="block w-full truncate text-left text-[13px] font-semibold text-[#efe7da] hover:text-[#e6c184]"
        >
          {video?.title || "Untitled"}
        </button>

        <div className="mt-1 flex items-center gap-2 overflow-hidden text-[10px] text-[#8b7c82]">
          {year(video) && (
            <span>{year(video)}</span>
          )}

          {video?.genres?.[0] && (
            <>
              <span>•</span>
              <span className="truncate">
                {video.genres[0]}
              </span>
            </>
          )}

          {num(video?.avgRating) > 0 && (
            <>
              <span>•</span>

              <span className="flex items-center gap-1 text-[#d9a653]">
                <Star
                  size={9}
                  fill="currentColor"
                />

                {num(video.avgRating).toFixed(1)}
              </span>
            </>
          )}
        </div>

        {progress > 0 && (
          <div className="mt-2 flex items-center justify-between text-[9px] text-[#8b7c82]">
            <span>{progress}% watched</span>

            <button
              type="button"
              onClick={() => onPlay?.(video)}
              className="text-[#d9a653] hover:text-[#e6c184]"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </article>
  );
}