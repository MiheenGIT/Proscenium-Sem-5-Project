import React, {useEffect,useState,} from "react";
import {useLocation,useNavigate,} from "react-router-dom";
import {Search,} from "lucide-react";
import { getRequest,} from "../../api/client.js";

import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import MovieCard from "../../components/Dashboard/MovieCard.jsx";
import {EmptyState,ErrorState,MovieCardSkeleton,} from "../../components/common/States.jsx";

export function LibraryPage({
  mode = "all",
  title = "Explore",
  subtitle = "Browse the Proscenium library.",
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(
    location.search
  );

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
      const results =
        await Promise.allSettled([
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

      if (
        videosResult.status ===
        "rejected"
      ) {
        throw videosResult.reason;
      }

      setVideos(
        videosResult.value?.videos || []
      );

      setWatchlist(
        watchlistResult.status ===
          "fulfilled"
          ? watchlistResult.value?.videos ||
              []
          : []
      );

      setLiked(
        likedResult.status ===
          "fulfilled"
          ? likedResult.value?.videos ||
              []
          : []
      );

      setGenres(
        genresResult.status ===
          "fulfilled"
          ? genresResult.value?.genres ||
              []
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
    const next =
      new URLSearchParams(
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
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-[.22em] text-[#d9a653]">
                Proscenium / Library
              </p>

              <h1 className="mt-2 font-[var(--font-display)] text-4xl text-[#efe7da]">
                {title}
              </h1>

              <p className="mt-2 text-sm text-[#8f8388]">
                {subtitle}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] px-3">
                <Search
                  size={14}
                  className="text-[#756a6f]"
                />

                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value
                    )
                  }
                  placeholder="Search this collection"
                  className="w-48 bg-transparent px-2 py-2.5 text-xs text-[#efe7da] outline-none placeholder:text-[#6f6468]"
                />
              </div>

              <select
                value={sort}
                onChange={(event) =>
                  setSort(
                    event.target.value
                  )
                }
                className="rounded-xl border border-white/10 bg-[#171216] px-3 py-2.5 text-xs text-[#cfc4c7] outline-none"
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

          {error ? (
            <div className="mt-8">
              <ErrorState
                message={error}
                onRetry={load}
              />
            </div>
          ) : loading ? (
            <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
            <div className="mt-8">
              <EmptyState
                title={
                  mode === "watchlist"
                    ? "Your watchlist is empty"
                    : mode === "liked"
                    ? "No liked films yet"
                    : "No results found"
                }
                message="Explore more stories and build your personal cinema."
                action={
                  <button
                    onClick={() =>
                      navigate(
                        "/viewer/explore"
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
            <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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