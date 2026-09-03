import React from "react";
import {Bookmark,Check,Info,Play,Star,} from "lucide-react";

const n = (value) => Number(value || 0);

const year = (video) =>
  video?.releaseYear ||
  (video?.publishedAt
    ? new Date(video.publishedAt).getFullYear()
    : "");

const mins = (seconds) => {
  seconds = Math.round(n(seconds));

  if (!seconds) return "";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return hours
    ? `${hours}h ${minutes}m`
    : `${minutes}m`;
};

export default function HeroBanner({
  video,
  saved,
  onSave,
  onPlay,
  onInfo,
  index = 0,
  total = 1,
  onPrev,
  onNext,
}) {
  if (!video) return null;

  return (
    <section className="relative min-h-[500px] overflow-hidden border-b border-white/[0.06] sm:min-h-[570px] lg:min-h-[610px]">
      <img
        src={video.thumbnailUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      <div className="absolute inset-0 bg-[linear-gradient(90deg,#100d10_0%,rgba(16,13,16,.9)_27%,rgba(16,13,16,.35)_68%,rgba(16,13,16,.7)_100%)]" />

      <div className="absolute inset-0 bg-[linear-gradient(0deg,#100d10_0%,transparent_38%,rgba(16,13,16,.2)_100%)]" />

      <div className="relative flex min-h-[500px] items-end px-6 pb-12 pt-28 sm:min-h-[570px] sm:px-10 lg:min-h-[610px] lg:px-12 lg:pb-16">
        <div className="max-w-2xl">
          <div className="mb-4 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.2em] text-[#d9a653]">
            <span className="rounded-full border border-[#d9a653]/30 bg-[#5c1220]/50 px-3 py-1">
              Featured
            </span>

            <span>Proscenium Selection</span>
          </div>

          <h1 className="max-w-2xl font-[var(--font-display)] text-4xl font-semibold leading-[.95] tracking-[-.035em] text-[#f5eee5] sm:text-6xl lg:text-7xl">
            {video.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-[11px] text-[#c0b5b8]">
            <span>{year(video)}</span>

            {video.durationSec > 0 && (
              <span>• {mins(video.durationSec)}</span>
            )}

            {video.ageRestricted && (
              <span className="rounded border border-white/15 px-1.5 py-0.5">
                18+
              </span>
            )}

            {n(video.avgRating) > 0 && (
              <span className="flex items-center gap-1 text-[#d9a653]">
                <Star
                  size={12}
                  fill="currentColor"
                />

                {n(video.avgRating).toFixed(1)}
              </span>
            )}

            {video.language && (
              <span>• {video.language}</span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(video.genres || [])
              .slice(0, 4)
              .map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[9px] text-[#d1c6c9] backdrop-blur"
                >
                  {genre}
                </span>
              ))}
          </div>

          <p className="mt-5 line-clamp-3 max-w-xl text-sm leading-6 text-[#c0b5b8] sm:text-[15px]">
            {video.description ||
              "A new story awaits. Step into the world of Proscenium."}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={() => onPlay(video)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#d9a653] px-5 py-3 text-xs font-bold text-[#100d10] transition hover:bg-[#e6c184]"
            >
              <Play
                size={15}
                fill="currentColor"
              />

              {video.progress > 0
                ? "Continue Watching"
                : "Watch Now"}
            </button>

            <button
              onClick={() => onSave(video)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-5 py-3 text-xs font-semibold text-[#efe7da] backdrop-blur transition hover:border-[#d9a653]/40"
            >
              {saved ? (
                <Check size={15} />
              ) : (
                <Bookmark size={15} />
              )}

              {saved
                ? "In Watchlist"
                : "Watchlist"}
            </button>

            <button
              onClick={() => onInfo(video)}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-black/30 text-[#efe7da] backdrop-blur transition hover:border-[#d9a653]/40"
              aria-label="More information"
            >
              <Info size={16} />
            </button>
          </div>
        </div>
      </div>

      {total > 1 && (
        <div className="absolute bottom-5 right-6 flex items-center gap-2 sm:right-10">
          <button
            onClick={onPrev}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/30 text-[#efe7da] backdrop-blur hover:border-[#d9a653]/40"
            aria-label="Previous featured film"
          >
            ‹
          </button>

          <div className="flex gap-1.5">
            {Array.from(
              { length: total },
              (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index
                      ? "w-7 bg-[#d9a653]"
                      : "w-1.5 bg-white/25"
                  }`}
                />
              )
            )}
          </div>

          <button
            onClick={onNext}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/30 text-[#efe7da] backdrop-blur hover:border-[#d9a653]/40"
            aria-label="Next featured film"
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
}