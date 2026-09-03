import React from "react";
import {Bookmark,Clock3,Heart,MessageSquare,Sparkles,Star,} from "lucide-react";
import { Avatar } from "./Sidebar.jsx";

export default function ActivityPanel({
  profile,
  history,
  watchlist,
  liked,
  reviews,
  onPlay,
}) {
  const name = profile?.username || "Viewer";

  return (
    <aside className="hidden w-[280px] shrink-0 border-l border-white/[0.07] px-5 py-7 xl:block">
      <div className="sticky top-[96px] space-y-5">
        <div>
          <p className="text-[9px] uppercase tracking-[.2em] text-[#756a6f]">
            Your cinema
          </p>

          <div className="mt-3 flex items-center gap-3">
            <Avatar
              src={profile?.avatarUrl}
              name={name}
            />

            <div>
              <h3 className="font-[var(--font-display)] text-lg text-[#efe7da]">
                Hi, {name}
              </h3>

              <p className="text-[9px] text-[#8b7c82]">
                Your personal viewing space
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            [Clock3, history.length, "Watched"],
            [Bookmark, watchlist.length, "Saved"],
            [Heart, liked.length, "Liked"],
            [MessageSquare, reviews.length, "Reviews"],
          ].map(([Icon, value, label]) => (
            <div
              key={label}
              className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
            >
              <Icon
                size={14}
                className="text-[#d9a653]"
              />

              <b className="mt-2 block text-lg text-[#efe7da]">
                {value}
              </b>

              <span className="text-[8px] uppercase tracking-[.14em] text-[#756a6f]">
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#d9a653]/15 bg-gradient-to-br from-[#5c1220]/60 to-white/[0.025] p-4">
          <div className="flex items-center gap-2 text-[#d9a653]">
            <Sparkles size={14} />

            <span className="text-[9px] font-bold uppercase tracking-[.16em]">
              Your taste
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(profile?.genrePreferences || [])
              .slice(0, 6)
              .map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-black/20 px-2.5 py-1 text-[8px] text-[#d6c6ca]"
                >
                  {genre}
                </span>
              ))}

            {!profile?.genrePreferences?.length && (
              <span className="text-[9px] text-[#9a8e93]">
                Choose genres to sharpen recommendations.
              </span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-[.15em] text-[#b8adb0]">
              Saved for later
            </h4>

            <Bookmark
              size={13}
              className="text-[#756a6f]"
            />
          </div>

          <div className="space-y-2">
            {watchlist.slice(0, 4).map((video) => (
              <button
                key={video.id}
                onClick={() => onPlay(video)}
                className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-white/[0.04]"
              >
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className="h-10 w-14 rounded-lg object-cover"
                />

                <span className="min-w-0">
                  <b className="block truncate text-[10px] text-[#ddd3d5]">
                    {video.title}
                  </b>

                  <small className="flex items-center gap-1 text-[8px] text-[#756a6f]">
                    <Star
                      size={8}
                      fill="currentColor"
                    />

                    {Number(
                      video.avgRating || 0
                    ).toFixed(1)}
                  </small>
                </span>
              </button>
            ))}

            {!watchlist.length && (
              <p className="text-[9px] text-[#756a6f]">
                Your watchlist is waiting.
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}