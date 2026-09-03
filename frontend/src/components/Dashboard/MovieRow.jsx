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
  action,
}) {
  if (!loading && !videos.length) {
    return null;
  }

  return (
    <section className="px-4 py-7 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-[var(--font-display)] text-[22px] font-semibold tracking-[-.02em] text-[#efe7da] sm:text-[25px]">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-[10px] text-[#8b7c82]">
              {subtitle}
            </p>
          )}
        </div>

        {action || (
          <span className="hidden text-[9px] uppercase tracking-[.18em] text-[#8b7c82] sm:block">
            {videos.length} titles
          </span>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading
          ? Array.from({ length: 6 }, (_, index) => (
              <MovieCardSkeleton key={index} />
            ))
          : videos.map((video) => (
              <MovieCard
                key={video.id}
                video={video}
                saved={savedIds.has(video.id)}
                liked={likedIds.has(video.id)}
                onSaved={onSaved}
                onLiked={onLiked}
                onPlay={onPlay}
              />
            ))}
      </div>
    </section>
  );
}