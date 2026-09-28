import React from "react";
import MovieCard from "./MovieCard.jsx";
import { MovieCardSkeleton } from "../common/States.jsx";

export default function MovieRow({
  title,
  subtitle,
  videos = [],
  loading = false,
  savedIds = new Set(),
  likedIds = new Set(),
  onPlay,
  onSaved,
  onLiked,
  onShowReviews,
  action,
}) {
  if (!loading && !videos.length) {
    return null;
  }

  return (
    <section className="w-full min-w-0 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px] min-w-0">

        {/* SECTION HEADER */}
        <div className="mb-5 flex min-w-0 items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-[var(--font-display)] text-[22px] font-semibold leading-tight tracking-[-.02em] text-[#efe7da] sm:text-[25px]">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-1.5 text-[10px] leading-5 text-[#8b7c82]">
                {subtitle}
              </p>
            )}
          </div>

          {action || (
            <span className="hidden shrink-0 text-[9px] uppercase tracking-[.18em] text-[#8b7c82] sm:block">
              {videos.length}{" "}
              {videos.length === 1
                ? "title"
                : "titles"}
            </span>
          )}
        </div>

        {/* VIDEO GRID */}
        <div
          className="
            grid
            w-full
            min-w-0
            grid-cols-2
            gap-x-4
            gap-y-9
            sm:grid-cols-3
            md:grid-cols-4
            lg:grid-cols-5
            xl:grid-cols-6
          "
        >
          {loading
            ? Array.from(
                { length: 6 },
                (_, index) => (
                  <MovieCardSkeleton
                    key={index}
                  />
                )
              )
            : videos.map((video) => (
                <MovieCard
                  key={video.id}
                  video={video}
                  saved={savedIds.has(
                    video.id
                  )}
                  liked={likedIds.has(
                    video.id
                  )}
                  onSaved={onSaved}
                  onLiked={onLiked}
                  onPlay={onPlay}
                  onShowReviews={
                    onShowReviews
                  }
                  className="w-full min-w-0"
                />
              ))}
        </div>
      </div>
    </section>
  );
}