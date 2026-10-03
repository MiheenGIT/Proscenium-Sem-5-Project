import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bookmark,
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

  const params = new URLSearchParams(
    location.search
  );

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
     BASE LIST
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

      const description = String(
        video.description || ""
      ).toLowerCase();

      const genresText = Array.isArray(
        video.genres
      )
        ? video.genres
            .join(" ")
            .toLowerCase()
        : "";

      const language = String(
        video.language || ""
      ).toLowerCase();

      return (
        title.includes(search) ||
        description.includes(search) ||
        genresText.includes(search) ||
        language.includes(search)
      );
    });
  }


  /* =========================================================
     COLLECTION DATA
  ========================================================= */

  const savedIds = useMemo(
    () =>
      new Set(
        watchlist.map(
          (video) => video.id
        )
      ),
    [watchlist]
  );

  const likedIds = useMemo(
    () =>
      new Set(
        liked.map(
          (video) => video.id
        )
      ),
    [liked]
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
     WATCHLIST STATISTICS
  ========================================================= */

  const watchlistGenreCount = useMemo(
    () =>
      new Set(
        watchlist.flatMap((video) =>
          Array.isArray(video.genres)
            ? video.genres
            : []
        )
      ).size,
    [watchlist]
  );


  const watchlistLanguages = useMemo(
    () =>
      new Set(
        watchlist
          .map((video) => video.language)
          .filter(Boolean)
      ).size,
    [watchlist]
  );


  const watchlistGenreList = useMemo(() => {
    const counts = {};

    watchlist.forEach((video) => {
      if (!Array.isArray(video.genres)) {
        return;
      }

      video.genres.forEach((item) => {
        if (!item) return;

        counts[item] =
          (counts[item] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [watchlist]);


  /* =========================================================
     WATCHLIST CHANGE
  ========================================================= */

  function savedChange(id, saved) {
    if (saved) {
      const video =
        videos.find(
          (item) => item.id === id
        ) ||
        liked.find(
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

    /*
     * Remove immediately from the local
     * watchlist so the card disappears
     * without requiring a full page reload.
     */
    setWatchlist((current) =>
      current.filter(
        (video) => video.id !== id
      )
    );
  }


  /* =========================================================
     LIKE CHANGE
  ========================================================= */

  function likedChange(
    id,
    isNowLiked
  ) {
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

    setLiked((current) =>
      current.filter(
        (video) => video.id !== id
      )
    );
  }


  /* =========================================================
     WATCHLIST PAGE
  ========================================================= */

  if (isWatchlist) {
    return (
      <DashboardLayout>
        <main className="w-full min-w-0 overflow-x-hidden px-4 py-7 sm:px-6 lg:px-8 lg:py-9">

          <div className="mx-auto w-full max-w-[1500px] min-w-0">


            {/* =================================================
                WATCHLIST HERO
            ================================================= */}

            <section className="relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-[#151014]">

              {/* Background atmosphere */}

              <div className="pointer-events-none absolute inset-0 overflow-hidden">

                <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-[#d9a653]/[0.07] blur-3xl" />

                <div className="absolute -bottom-40 left-[28%] h-96 w-96 rounded-full bg-[#5c1220]/[0.20] blur-3xl" />

                <div className="absolute right-[30%] top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-[#8f5c3a]/[0.04] blur-3xl" />

              </div>


              {/* Content */}

              <div className="relative z-10 px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">

                <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">

                  <div className="max-w-3xl">

                    {/* Eyebrow */}

                    <div className="flex items-center gap-2">

                      <span className="grid h-8 w-8 place-items-center rounded-full border border-[#d9a653]/20 bg-[#d9a653]/[0.07]">

                        <Bookmark
                          size={14}
                          fill="currentColor"
                          className="text-[#d9a653]"
                        />

                      </span>

                      <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#d9a653]">
                        Your personal shelf
                      </p>

                    </div>


                    {/* Heading */}

                    <h1 className="mt-5 font-[var(--font-display)] text-4xl leading-[1.05] text-[#efe7da] sm:text-5xl lg:text-[58px]">

                      Watchlist

                    </h1>


                    <p className="mt-4 max-w-2xl text-sm leading-6 text-[#93878c] sm:text-[15px]">

                      A private shelf for the stories
                      you want to come back to.

                    </p>


                    {/* Stats */}

                    <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">

                      <WatchlistStat
                        value={
                          watchlist.length
                        }
                        label={
                          watchlist.length === 1
                            ? "saved film"
                            : "saved films"
                        }
                      />

                      <span className="hidden h-7 w-px bg-white/[0.08] sm:block" />

                      <WatchlistStat
                        value={
                          watchlistGenreCount
                        }
                        label={
                          watchlistGenreCount ===
                          1
                            ? "genre"
                            : "genres"
                        }
                      />

                      <span className="hidden h-7 w-px bg-white/[0.08] sm:block" />

                      <WatchlistStat
                        value={
                          watchlistLanguages
                        }
                        label={
                          watchlistLanguages ===
                          1
                            ? "language"
                            : "languages"
                        }
                      />

                    </div>

                  </div>


                  {/* Collection card */}

                  <div className="hidden w-[240px] shrink-0 rounded-2xl border border-white/[0.07] bg-black/20 p-4 lg:block">

                    <div className="flex items-center justify-between">

                      <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#6f6569]">
                        Saved library
                      </span>

                      <Bookmark
                        size={14}
                        className="text-[#d9a653]"
                      />

                    </div>


                    <div className="mt-5">

                      <span className="font-[var(--font-display)] text-3xl text-[#e9dfd5]">
                        {watchlist.length}
                      </span>

                      <span className="ml-2 text-[10px] text-[#70676a]">
                        titles
                      </span>

                    </div>


                    <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">

                      <div
                        className="h-full rounded-full bg-[#d9a653]"
                        style={{
                          width:
                            watchlist.length
                              ? "100%"
                              : "0%",
                        }}
                      />

                    </div>


                    <p className="mt-3 text-[9px] leading-4 text-[#6f6569]">
                      Save anything you want
                      to watch later from
                      anywhere in Proscenium.
                    </p>

                  </div>

                </div>

              </div>

            </section>


            {/* =================================================
                QUICK GENRE STRIP
            ================================================= */}

            {!loading &&
              !error &&
              watchlist.length > 0 &&
              watchlistGenreList.length > 0 && (

                <section className="mt-6">

                  <div className="mb-3 flex items-center justify-between">

                    <div>

                      <p className="text-[8px] uppercase tracking-[0.2em] text-[#625a5e]">
                        Browse saved films
                      </p>

                      <h2 className="mt-1 text-sm font-semibold text-[#cfc4c6]">
                        Your genres
                      </h2>

                    </div>

                    {genre && (
                      <button
                        type="button"
                        onClick={() =>
                          setGenre("")
                        }
                        className="text-[9px] text-[#d9a653] hover:text-[#e6c184]"
                      >
                        Clear filter
                      </button>
                    )}

                  </div>


                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

                    <button
                      type="button"
                      onClick={() =>
                        setGenre("")
                      }
                      className={`shrink-0 rounded-full border px-4 py-2.5 text-[9px] font-medium transition ${
                        !genre
                          ? "border-[#d9a653] bg-[#5c1220] text-[#e6c184]"
                          : "border-white/[0.08] bg-white/[0.02] text-[#81777b] hover:border-white/[0.14] hover:text-[#c9c0c2]"
                      }`}
                    >
                      All saved
                    </button>


                    {watchlistGenreList.map(
                      (item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            setGenre(
                              genre === item
                                ? ""
                                : item
                            )
                          }
                          className={`shrink-0 rounded-full border px-4 py-2.5 text-[9px] font-medium transition ${
                            genre === item
                              ? "border-[#d9a653] bg-[#5c1220] text-[#e6c184]"
                              : "border-white/[0.08] bg-white/[0.02] text-[#81777b] hover:border-white/[0.14] hover:text-[#c9c0c2]"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}

                  </div>

                </section>

              )}


            {/* =================================================
                TOOLBAR
            ================================================= */}

            <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-[#121012] p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">

              {/* Search */}

              <div className="relative min-w-0 flex-1 lg:max-w-xl">

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
                  placeholder="Search your saved films..."
                  className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] pl-11 pr-10 text-xs text-[#efe7da] outline-none transition placeholder:text-[#655c60] focus:border-[#d9a653]/30 focus:bg-white/[0.035]"
                />

                {query && (
                  <button
                    type="button"
                    onClick={() =>
                      setQuery("")
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#6e6569] transition hover:bg-white/[0.06] hover:text-[#d8ced0]"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}

              </div>


              <div className="flex flex-wrap items-center gap-2">

                {query && (
                  <span className="mr-1 text-[9px] text-[#6f6569]">
                    {list.length}{" "}
                    {list.length === 1
                      ? "result"
                      : "results"}
                  </span>
                )}


                <span className="hidden text-[9px] uppercase tracking-[0.18em] text-[#665d61] sm:block">
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
                COLLECTION HEADING
            ================================================= */}

            {!loading &&
              !error &&
              watchlist.length > 0 && (

                <div className="mt-9 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">

                  <div>

                    <p className="text-[8px] uppercase tracking-[0.2em] text-[#625a5e]">
                      {genre
                        ? `Genre / ${genre}`
                        : query
                        ? "Search"
                        : "Your saved collection"}
                    </p>

                    <h2 className="mt-1 font-[var(--font-display)] text-2xl text-[#e7ded4]">
                      {query
                        ? "Search results"
                        : genre
                        ? `${genre} in your watchlist`
                        : "Saved for later"}
                    </h2>

                  </div>


                  <div className="flex items-center gap-3">

                    {genre && (
                      <button
                        type="button"
                        onClick={() =>
                          setGenre("")
                        }
                        className="inline-flex items-center gap-1.5 text-[9px] text-[#857a7e] transition hover:text-[#d9a653]"
                      >
                        <X size={12} />
                        Clear genre
                      </button>
                    )}

                    <span className="text-[10px] text-[#6f666a]">
                      {list.length}{" "}
                      {list.length === 1
                        ? "film"
                        : "films"}
                    </span>

                  </div>

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

            ) : !watchlist.length ? (

              /* =================================================
                 EMPTY WATCHLIST
              ================================================= */

              <section className="relative mt-8 overflow-hidden rounded-[30px] border border-white/[0.07] bg-[#121012]">

                <div className="pointer-events-none absolute inset-0">

                  <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5c1220]/[0.17] blur-3xl" />

                  <div className="absolute right-0 top-0 h-60 w-60 rounded-full bg-[#d9a653]/[0.04] blur-3xl" />

                </div>


                <div className="relative px-6 py-20 text-center sm:px-10 sm:py-24">

                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-[24px] border border-[#d9a653]/10 bg-[#d9a653]/[0.05]">

                    <Bookmark
                      size={29}
                      className="text-[#9d8060]"
                    />

                  </div>


                  <p className="mt-6 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#d9a653]">
                    Your shelf is waiting
                  </p>


                  <h2 className="mt-3 font-[var(--font-display)] text-3xl text-[#e7ded4] sm:text-4xl">
                    Nothing saved yet
                  </h2>


                  <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#7d7377]">
                    When you find a film you
                    want to watch later, tap the
                    bookmark and it will appear
                    here.
                  </p>


                  <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          "/explore"
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-[#d9a653] px-5 py-3 text-xs font-bold text-[#100d10] transition hover:bg-[#e6b766]"
                    >
                      Explore films
                      <ArrowUpRight
                        size={14}
                      />
                    </button>


                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          "/viewer"
                        )
                      }
                      className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 py-3 text-xs text-[#bdb2b5] transition hover:bg-white/[0.06]"
                    >
                      Back to home
                    </button>

                  </div>

                </div>

              </section>

            ) : !list.length ? (

              /* =================================================
                 NO SEARCH / GENRE RESULTS
              ================================================= */

              <section className="mt-8 rounded-[28px] border border-white/[0.07] bg-[#121012] px-6 py-16 text-center">

                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.025]">

                  <Search
                    size={20}
                    className="text-[#6d6468]"
                  />

                </div>


                <h2 className="mt-5 font-[var(--font-display)] text-2xl text-[#e7ded4]">
                  No films found
                </h2>


                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#7d7377]">

                  {query
                    ? `Nothing in your watchlist matches "${query}".`
                    : `There are no saved ${genre} films in your watchlist.`}

                </p>


                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">

                  {query && (
                    <button
                      type="button"
                      onClick={() =>
                        setQuery("")
                      }
                      className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2.5 text-xs text-[#c9c0c2] transition hover:bg-white/[0.07]"
                    >
                      Clear search
                    </button>
                  )}


                  {genre && (
                    <button
                      type="button"
                      onClick={() =>
                        setGenre("")
                      }
                      className="rounded-xl bg-[#d9a653] px-4 py-2.5 text-xs font-bold text-[#100d10] transition hover:bg-[#e6b766]"
                    >
                      Show all saved films
                    </button>
                  )}

                </div>

              </section>

            ) : (

              /* =================================================
                 WATCHLIST GRID
              ================================================= */

              <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">

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


            {/* =================================================
                WATCHLIST FOOTER
            ================================================= */}

            {!loading &&
              !error &&
              watchlist.length > 0 &&
              !query &&
              !genre && (

                <div className="mt-14 flex flex-col items-center justify-center gap-2 border-t border-white/[0.06] pt-7 text-center">

                  <div className="flex items-center gap-2 text-[#6c6367]">

                    <Sparkles size={13} />

                    <span className="text-[9px] uppercase tracking-[0.2em]">
                      Your personal shelf
                    </span>

                  </div>


                  <p className="text-[11px] text-[#625a5e]">
                    {watchlist.length}{" "}
                    {watchlist.length === 1
                      ? "film"
                      : "films"}{" "}
                    saved for your next
                    viewing session.
                  </p>

                </div>

              )}

          </div>

        </main>
      </DashboardLayout>
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

            <section className="relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-[#151014] px-5 py-7 sm:px-7 lg:px-9 lg:py-8">

              <div className="pointer-events-none absolute inset-0 overflow-hidden">

                <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#d9a653]/[0.07] blur-3xl" />

                <div className="absolute -bottom-32 left-[35%] h-72 w-72 rounded-full bg-[#5c1220]/[0.18] blur-3xl" />

              </div>


              <div className="relative z-10">

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


            <section className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

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


            {error ? (

              <div className="mt-8">

                <ErrorState
                  message={error}
                  onRetry={load}
                />

              </div>

            ) : loading ? (

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
                    Proscenium / Library
                  </p>

                </div>


                <h1 className="mt-2 break-words font-[var(--font-display)] text-3xl leading-tight text-[#efe7da] sm:text-4xl">
                  {title}
                </h1>


                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8f8388]">
                  {subtitle}
                </p>

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
                    placeholder="Search this collection"
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
                title="No results found"
                message="Explore more stories and build your personal cinema."
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
   WATCHLIST STAT
========================================================= */

function WatchlistStat({
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