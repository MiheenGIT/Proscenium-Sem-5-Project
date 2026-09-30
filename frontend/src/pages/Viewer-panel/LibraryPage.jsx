import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Heart,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { getRequest } from "../../api/client.js";

import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import MovieCard from "../../components/Dashboard/MovieCard.jsx";
import CustomSelect from "../../components/CustomSelect.jsx";

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

  const isLiked = mode === "liked";
  const isWatchlist = mode === "watchlist";

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


  /* =========================================================
     LOAD DATA
  ========================================================= */

  async function load() {
    setLoading(true);
    setError("");

    try {
      const videoUrl =
        `/viewer/videos?limit=100` +
        (genre
          ? `&genre=${encodeURIComponent(genre)}`
          : "");

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
      console.error(
        "Failed to load library:",
        err
      );

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


  /* =========================================================
     UPDATE URL
  ========================================================= */

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


  /* =========================================================
     BUILD CURRENT LIST
  ========================================================= */

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


  /* =========================================================
     SORT
  ========================================================= */

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


  /* =========================================================
     SEARCH
  ========================================================= */

  if (query.trim()) {
    const search =
      query.trim().toLowerCase();

    list = list.filter((video) => {
      const title = String(
        video.title || ""
      ).toLowerCase();

      const genresText = Array.isArray(
        video.genres
      )
        ? video.genres.join(" ").toLowerCase()
        : "";

      return (
        title.includes(search) ||
        genresText.includes(search)
      );
    });
  }


  /* =========================================================
     COLLECTION DATA
  ========================================================= */

  const savedIds = new Set(
    watchlist.map((video) => video.id)
  );

  const likedIds = new Set(
    liked.map((video) => video.id)
  );


  const likedCount = liked.length;


  const ratedLikedCount = liked.filter(
    (video) =>
      Number(video.avgRating || 0) > 0
  ).length;


  const genreCount = new Set(
    liked.flatMap((video) =>
      Array.isArray(video.genres)
        ? video.genres
        : []
    )
  ).size;


  /* =========================================================
     WATCHLIST CHANGE
  ========================================================= */

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

      return;
    }

    setWatchlist((current) =>
      current.filter(
        (video) => video.id !== id
      )
    );
  }


  /* =========================================================
     LIKE CHANGE
  ========================================================= */

  function likedChange(id, isNowLiked) {
    if (isNowLiked) {
      const source =
        videos.find(
          (item) => item.id === id
        ) ||
        watchlist.find(
          (item) => item.id === id
        );

      if (!source) return;

      setLiked((current) =>
        current.some(
          (item) => item.id === id
        )
          ? current
          : [source, ...current]
      );

      return;
    }

    /*
     * On the Liked Videos page the card
     * disappears immediately after unlike.
     */
    setLiked((current) =>
      current.filter(
        (video) => video.id !== id
      )
    );
  }


  /* =========================================================
     LIKED VIDEOS PAGE
  ========================================================= */

  if (isLiked) {
    return (
      <DashboardLayout>
        <main className="w-full min-w-0 overflow-x-hidden px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          <div className="mx-auto w-full max-w-[1500px] min-w-0">


            {/* =================================================
                HERO
            ================================================= */}

            <section className="relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-[#151014] px-5 py-7 sm:px-7 lg:px-9 lg:py-8">

              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#d9a653]/[0.07] blur-3xl" />

                <div className="absolute -bottom-32 left-[35%] h-72 w-72 rounded-full bg-[#5c1220]/[0.18] blur-3xl" />
              </div>


              <div className="relative z-10">

                {/* Eyebrow */}

                <div className="flex items-center gap-2">

                  <span className="grid h-7 w-7 place-items-center rounded-full border border-[#d9a653]/20 bg-[#d9a653]/[0.07]">
                    <Heart
                      size={13}
                      fill="currentColor"
                      className="text-[#d9a653]"
                    />
                  </span>

                  <p className="text-[9px] uppercase tracking-[0.25em] text-[#d9a653]">
                    Your personal collection
                  </p>

                </div>


                {/* Heading */}

                <div className="mt-4 max-w-3xl">

                  <h1 className="font-[var(--font-display)] text-4xl leading-tight text-[#efe7da] sm:text-5xl lg:text-[54px]">
                    Liked Videos
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#93878c]">
                    The films that caught your
                    attention. Everything you
                    liked, kept together in one
                    place.
                  </p>

                </div>


                {/* Stats */}

                <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3">

                  <CollectionStat
                    value={likedCount}
                    label={
                      likedCount === 1
                        ? "liked film"
                        : "liked films"
                    }
                  />

                  <span className="hidden h-8 w-px bg-white/[0.08] sm:block" />

                  <CollectionStat
                    value={ratedLikedCount}
                    label="rated"
                  />

                  <span className="hidden h-8 w-px bg-white/[0.08] sm:block" />

                  <CollectionStat
                    value={genreCount}
                    label={
                      genreCount === 1
                        ? "genre"
                        : "genres"
                    }
                  />

                </div>

              </div>

            </section>


            {/* =================================================
                TOOLBAR
            ================================================= */}

            <section className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

              {/* Search */}

              <div className="relative w-full lg:max-w-md">

                <Search
                  size={15}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6e6569]"
                />

                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value
                    )
                  }
                  placeholder="Search liked videos..."
                  className="h-11 w-full rounded-xl border border-white/[0.07] bg-[#121012] pl-11 pr-10 text-xs text-[#efe7da] outline-none transition placeholder:text-[#655c60] focus:border-[#d9a653]/30"
                />

                {query && (
                  <button
                    type="button"
                    onClick={() =>
                      setQuery("")
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6e6569] transition hover:text-[#d8ced0]"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}

              </div>


              {/* Sort */}

              <div className="flex flex-wrap items-center gap-2">

                <span className="mr-1 hidden text-[9px] uppercase tracking-[0.18em] text-[#665d61] sm:block">
                  Sort
                </span>

                <CustomSelect
                  value={sort}
                  onChange={(val) =>
                    setSort(val)
                  }
                  options={[
                    {
                      value: "recent",
                      label: "Recently added",
                    },
                    {
                      value: "rating",
                      label: "Highest rated",
                    },
                    {
                      value: "views",
                      label: "Most watched",
                    },
                    {
                      value: "title",
                      label: "A–Z",
                    },
                  ]}
                  size="md"
                  align="right"
                  className="shrink-0"
                />

              </div>

            </section>


            {/* =================================================
                COLLECTION TITLE
            ================================================= */}

            {!loading &&
              !error &&
              liked.length > 0 && (

                <div className="mt-8 flex items-end justify-between gap-4">

                  <div>

                    <p className="text-[9px] uppercase tracking-[0.2em] text-[#625a5e]">
                      Your collection
                    </p>

                    <h2 className="mt-1 font-[var(--font-display)] text-2xl text-[#e7ded4]">
                      {query
                        ? "Search results"
                        : "Films you liked"}
                    </h2>

                  </div>

                  <span className="text-[10px] text-[#6f666a]">
                    {list.length}{" "}
                    {list.length === 1
                      ? "film"
                      : "films"}
                  </span>

                </div>
              )}


            {/* =================================================
                ERROR
            ================================================= */}

            {error ? (

              <div className="mt-8">

                <ErrorState
                  message={error}
                  onRetry={load}
                />

              </div>

            ) : loading ? (

              /* =================================================
                 LOADING
              ================================================= */

              <div className="mt-8 grid w-full grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">

                {Array.from(
                  { length: 12 },
                  (_, index) => (
                    <MovieCardSkeleton
                      key={index}
                    />
                  )
                  )}

              </div>

            ) : !liked.length ? (

              /* =================================================
                 EMPTY
              ================================================= */

              <section className="mt-8 overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#121012]">

                <div className="relative px-6 py-20 text-center sm:px-10">

                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5c1220]/[0.16] blur-3xl" />

                  <div className="relative">

                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[#d9a653]/10 bg-[#d9a653]/[0.05]">

                      <Heart
                        size={24}
                        className="text-[#9d8060]"
                      />

                    </div>


                    <h2 className="mt-6 font-[var(--font-display)] text-2xl text-[#e7ded4]">
                      Nothing here yet
                    </h2>


                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#7d7377]">
                      Like films while exploring
                      Proscenium and they'll appear
                      here for you.
                    </p>


                    <button
                      type="button"
                      onClick={() =>
                        navigate("/explore")
                      }
                      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#d9a653] px-5 py-3 text-xs font-bold text-[#100d10] transition hover:bg-[#e6b766]"
                    >
                      Explore films
                      <ArrowUpRight
                        size={14}
                      />
                    </button>

                  </div>

                </div>

              </section>

            ) : !list.length ? (

              /* =================================================
                 NO SEARCH RESULTS
              ================================================= */

              <section className="mt-8 rounded-[24px] border border-white/[0.07] bg-[#121012] px-6 py-16 text-center">

                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.025]">

                  <Search
                    size={20}
                    className="text-[#6d6468]"
                  />

                </div>


                <h2 className="mt-5 font-[var(--font-display)] text-2xl text-[#e7ded4]">
                  No matching films
                </h2>


                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#7d7377]">
                  We couldn't find a liked video
                  matching "{query}".
                </p>


                <button
                  type="button"
                  onClick={() =>
                    setQuery("")
                  }
                  className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2.5 text-xs text-[#c9c0c2] transition hover:bg-white/[0.07]"
                >
                  Clear search
                </button>

              </section>

            ) : (

              /* =================================================
                 GRID
              ================================================= */

              <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">

                {list.map((video) => (

                  <MovieCard
                    key={video.id}
                    video={video}
                    saved={savedIds.has(
                      video.id
                    )}
                    liked={true}
                    onPlay={(item) =>
                      navigate(
                        `/viewer/videos/${item.id}`
                      )
                    }
                    onSaved={savedChange}
                    onLiked={likedChange}
                    className="w-full min-w-0"
                  />

                ))}

              </div>

            )}


            {/* =================================================
                FOOTER
            ================================================= */}

            {!loading &&
              !error &&
              liked.length > 0 &&
              !query && (

                <div className="mt-14 flex flex-col items-center justify-center gap-2 border-t border-white/[0.06] pt-7 text-center">

                  <div className="flex items-center gap-2 text-[#6c6367]">

                    <Sparkles size={13} />

                    <span className="text-[9px] uppercase tracking-[0.2em]">
                      Your collection
                    </span>

                  </div>

                  <p className="text-[11px] text-[#625a5e]">
                    {liked.length}{" "}
                    {liked.length === 1
                      ? "film"
                      : "films"}{" "}
                    you chose to keep close.
                  </p>

                </div>

              )}

          </div>
        </main>
      </DashboardLayout>
    );
  }


  /* =========================================================
     OTHER LIBRARY PAGES
  ========================================================= */

  return (
    <DashboardLayout>

      <main className="w-full min-w-0 overflow-x-hidden px-4 py-7 sm:px-6 lg:px-8 lg:py-9">

        <div className="mx-auto w-full max-w-[1500px] min-w-0">

          <header className="relative rounded-[28px] border border-white/[0.07] bg-[#151014] px-5 py-6 sm:px-7 sm:py-7">

            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">

              <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#d9a653]/[0.06] blur-3xl" />

              <div className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-[#5c1220]/[0.16] blur-3xl" />

            </div>


            <div className="relative z-10 flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

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
                  {title}
                </h1>


                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8f8388]">
                  {subtitle}
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


              <div className="flex min-w-0 flex-wrap gap-2 lg:justify-end">

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


                <CustomSelect
                  value={sort}
                  onChange={(val) =>
                    setSort(val)
                  }
                  options={[
                    {
                      value: "recent",
                      label: "Recently added",
                    },
                    {
                      value: "rating",
                      label: "Highest rated",
                    },
                    {
                      value: "views",
                      label: "Most watched",
                    },
                    {
                      value: "title",
                      label: "A–Z",
                    },
                  ]}
                  size="md"
                  align="right"
                  className="shrink-0"
                />

              </div>

            </div>

          </header>


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


          {error ? (

            <div className="mt-8">

              <ErrorState
                message={error}
                onRetry={load}
              />

            </div>

          ) : loading ? (

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

            <div className="mt-8">

              <EmptyState
                title={
                  mode === "watchlist"
                    ? "Your watchlist is empty"
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
                      navigate("/explore")
                    }
                    className="mt-5 rounded-xl bg-[#d9a653] px-4 py-2 text-xs font-bold text-[#100d10]"
                  >
                    Explore films
                  </button>
                }
              />

            </div>

          ) : (

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
                  onLiked={likedChange}
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


/* =========================================================
   COLLECTION STAT
========================================================= */

function CollectionStat({
  value,
  label,
}) {
  return (
    <div className="flex items-baseline gap-2">

      <span className="font-[var(--font-display)] text-xl text-[#e9dfd5]">
        {value}
      </span>

      <span className="text-[9px] uppercase tracking-[0.15em] text-[#6f6569]">
        {label}
      </span>

    </div>
  );
}


/* =========================================================
   EXPLORE
========================================================= */

export function Explore() {
  return (
    <LibraryPage
      title="Explore"
      subtitle="Find your next story by genre, taste, and popularity."
    />
  );
}


/* =========================================================
   TRENDING
========================================================= */

export function Trending() {
  return (
    <LibraryPage
      mode="trending"
      title="Trending"
      subtitle="The stories getting the most attention right now."
    />
  );
}


/* =========================================================
   FOR YOU
========================================================= */

export function ForYou() {
  return (
    <LibraryPage
      mode="for-you"
      title="For You"
      subtitle="A personal shelf shaped by your library and viewing taste."
    />
  );
}


/* =========================================================
   LIKED VIDEOS
========================================================= */

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