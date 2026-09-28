import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { getRequest } from "../../api/client.js";

import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import MovieCard from "../../components/Dashboard/MovieCard.jsx";
import {
  EmptyState,
  ErrorState,
  MovieCardSkeleton,
} from "../../components/common/States.jsx";

export function LibraryPage({
  mode = "all",
  title = "Explore",
  subtitle = "Browse the Proscenium library.",
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);

  const [videos, setVideos] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [liked, setLiked] = useState([]);
  const [genres, setGenres] = useState([]);

  const [genre, setGenre] = useState(
    params.get("genre") || ""
  );

  const [sort, setSort] = useState(
    params.get("sort") || "recent"
  );

  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const videoUrl =
        `/viewer/videos?limit=100` +
        (genre
          ? `&genre=${encodeURIComponent(genre)}`
          : "");

      /*
       * Do not replace this endpoint.
       *
       * Your backend decides which videos are
       * approved/public.
       */
      const results = await Promise.allSettled([
        getRequest(videoUrl),
        getRequest("/viewer/watchlist"),
        getRequest("/viewer/liked"),
        getRequest("/viewer/genres"),
      ]);

      const [
        videosResult,
        watchlistResult,
        likedResult,
        genresResult,
      ] = results;

      if (videosResult.status === "rejected") {
        throw videosResult.reason;
      }

      setVideos(
        videosResult.value?.videos || []
      );

      setWatchlist(
        watchlistResult.status === "fulfilled"
          ? watchlistResult.value?.videos || []
          : []
      );

      setLiked(
        likedResult.status === "fulfilled"
          ? likedResult.value?.videos || []
          : []
      );

      setGenres(
        genresResult.status === "fulfilled"
          ? genresResult.value?.genres || []
          : []
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load the library."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [genre]);

  useEffect(() => {
    const next = new URLSearchParams(
      location.search
    );

    if (genre) {
      next.set("genre", genre);
    } else {
      next.delete("genre");
    }

    if (sort !== "recent") {
      next.set("sort", sort);
    } else {
      next.delete("sort");
    }

    const search = next.toString();

    navigate(
      `${location.pathname}${
        search ? `?${search}` : ""
      }`,
      {
        replace: true,
      }
    );
  }, [genre, sort]);

  let list =
    mode === "watchlist"
      ? watchlist
      : mode === "liked"
      ? liked
      : videos;

  if (mode === "trending") {
    list = [...videos].sort(
      (a, b) =>
        Number(b.views || 0) -
        Number(a.views || 0)
    );
  }

  if (mode === "for-you") {
    list = [...videos].sort(
      (a, b) =>
        Number(b.avgRating || 0) -
        Number(a.avgRating || 0)
    );
  }

  if (sort === "rating") {
    list = [...list].sort(
      (a, b) =>
        Number(b.avgRating || 0) -
        Number(a.avgRating || 0)
    );
  }

  if (sort === "title") {
    list = [...list].sort(
      (a, b) =>
        String(a.title || "").localeCompare(
          String(b.title || "")
        )
    );
  }

  if (sort === "views") {
    list = [...list].sort(
      (a, b) =>
        Number(b.views || 0) -
        Number(a.views || 0)
    );
  }

  if (query.trim()) {
    const search =
      query.trim().toLowerCase();

    list = list.filter((video) =>
      String(video.title || "")
        .toLowerCase()
        .includes(search)
    );
  }

  const isWatchlist = mode === "watchlist";

  const pageTitle = isWatchlist
    ? "Watchlist"
    : title;

  const pageSubtitle = isWatchlist
    ? "Your saved films, ready whenever you are."
    : subtitle;

  const savedIds = new Set(
    watchlist.map((video) => video.id)
  );

  const likedIds = new Set(
    liked.map((video) => video.id)
  );

  function savedChange(id, saved) {
    if (saved) {
      const video = videos.find(
        (item) => item.id === id
      );

      if (!video) return;

      setWatchlist((current) =>
        current.some(
          (item) => item.id === id
        )
          ? current
          : [video, ...current]
      );
    } else {
      setWatchlist((current) =>
        current.filter(
          (video) => video.id !== id
        )
      );
    }
  }

  return (
    <DashboardLayout>
      <main className="w-full min-w-0 overflow-x-hidden px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <div className="mx-auto w-full max-w-[1500px] min-w-0">

          {/* =========================
              PAGE HEADER
          ========================= */}
          <header
            className={`relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#151014] px-5 py-6 sm:px-7 sm:py-7 ${
              isWatchlist
                ? "shadow-[0_24px_70px_rgba(0,0,0,.22)]"
                : ""
            }`}
          >
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#d9a653]/[0.06] blur-3xl" />

            <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-[#5c1220]/[0.16] blur-3xl" />

            <div className="relative flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

              {/* Header text */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[9px] uppercase tracking-[.24em] text-[#d9a653]">
                    Proscenium /{" "}
                    {isWatchlist
                      ? "Your collection"
                      : "Library"}
                  </p>

                  {isWatchlist && (
                    <span className="rounded-full border border-[#d9a653]/20 bg-[#d9a653]/[0.08] px-2.5 py-1 text-[8px] uppercase tracking-[.16em] text-[#d9a653]">
                      Saved for later
                    </span>
                  )}
                </div>

                <h1 className="mt-2 break-words font-[var(--font-display)] text-3xl leading-tight text-[#efe7da] sm:text-4xl">
                  {pageTitle}
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8f8388]">
                  {pageSubtitle}
                </p>

                {isWatchlist &&
                  !loading &&
                  !error && (
                    <p className="mt-4 text-[10px] uppercase tracking-[.16em] text-[#756a6f]">
                      {watchlist.length}{" "}
                      {watchlist.length === 1
                        ? "film"
                        : "films"}{" "}
                      saved
                    </p>
                  )}
              </div>

              {/* Header controls */}
              <div className="flex min-w-0 flex-wrap gap-2 lg:justify-end">

                {/* Search */}
                <div className="flex min-w-0 items-center rounded-xl border border-white/10 bg-white/[0.03] px-3">
                  <Search
                    size={14}
                    className="shrink-0 text-[#756a6f]"
                  />

                  <input
                    value={query}
                    onChange={(event) =>
                      setQuery(
                        event.target.value
                      )
                    }
                    placeholder={
                      isWatchlist
                        ? "Search your watchlist"
                        : "Search this collection"
                    }
                    className="w-[min(48vw,220px)] min-w-0 bg-transparent px-2 py-2.5 text-xs text-[#efe7da] outline-none placeholder:text-[#6f6468]"
                  />
                </div>

                {/* Sort */}
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(
                      event.target.value
                    )
                  }
                  className="shrink-0 rounded-xl border border-white/10 bg-[#171216] px-3 py-2.5 text-xs text-[#cfc4c7] outline-none"
                >
                  <option value="recent">
                    Recently added
                  </option>

                  <option value="rating">
                    Highest rated
                  </option>

                  <option value="views">
                    Most watched
                  </option>

                  <option value="title">
                    A–Z
                  </option>
                </select>
              </div>
            </div>
          </header>

          {/* =========================
              GENRE FILTERS
          ========================= */}
          {!isWatchlist && (
            <div className="mt-8 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() =>
                  setGenre("")
                }
                className={`shrink-0 rounded-full border px-4 py-2 text-[9px] ${
                  !genre
                    ? "border-[#d9a653] bg-[#5c1220] text-[#e6c184]"
                    : "border-white/10 text-[#93878c]"
                }`}
              >
                All
              </button>

              {genres.map((item) => (
                <button
                  key={item}
                  onClick={() =>
                    setGenre(
                      item === genre
                        ? ""
                        : item
                    )
                  }
                  className={`shrink-0 rounded-full border px-4 py-2 text-[9px] ${
                    genre === item
                      ? "border-[#d9a653] bg-[#5c1220] text-[#e6c184]"
                      : "border-white/10 text-[#93878c]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {/* =========================
              ERROR
          ========================= */}
          {error ? (
            <div className="mt-8">
              <ErrorState
                message={error}
                onRetry={load}
              />
            </div>

          ) : loading ? (

            /* =========================
               LOADING GRID
            ========================= */
            <div className="mt-8 grid w-full min-w-0 grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {Array.from(
                { length: 12 },
                (_, index) => (
                  <MovieCardSkeleton
                    key={index}
                  />
                )
              )}
            </div>

          ) : !list.length ? (

            /* =========================
               EMPTY STATE
            ========================= */
            <div className="mt-8">
              <EmptyState
                title={
                  mode === "watchlist"
                    ? "Your watchlist is empty"
                    : mode === "liked"
                    ? "No liked films yet"
                    : "No results found"
                }
                message={
                  mode === "watchlist"
                    ? "Save films you want to watch later. They will stay here until you remove them."
                    : "Explore more stories and build your personal cinema."
                }
                action={
                  <button
                    onClick={() =>
                      navigate(
                        "/explore"
                      )
                    }
                    className="mt-5 rounded-xl bg-[#d9a653] px-4 py-2 text-xs font-bold text-[#100d10]"
                  >
                    Explore films
                  </button>
                }
              />
            </div>

          ) : (

            /* =========================
               VIDEO GRID
            ========================= */
            <div className="mt-8 grid w-full min-w-0 grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {list.map((video) => (
                <MovieCard
                  key={video.id}
                  video={video}
                  saved={savedIds.has(
                    video.id
                  )}
                  liked={likedIds.has(
                    video.id
                  )}
                  onPlay={(item) =>
                    navigate(
                      `/viewer/videos/${item.id}`
                    )
                  }
                  onSaved={savedChange}
                  className="w-full min-w-0"
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}

export function Explore() {
  return (
    <LibraryPage
      title="Explore"
      subtitle="Find your next story by genre, taste, and popularity."
    />
  );
}

export function Trending() {
  return (
    <LibraryPage
      mode="trending"
      title="Trending"
      subtitle="The stories getting the most attention right now."
    />
  );
}

export function ForYou() {
  return (
    <LibraryPage
      mode="for-you"
      title="For You"
      subtitle="A personal shelf shaped by your library and viewing taste."
    />
  );
}

export function Liked() {
  return (
    <LibraryPage
      mode="liked"
      title="Liked Videos"
      subtitle="Everything you chose to keep close."
    />
  );
}

export default LibraryPage;