import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clock3, Play, Search, SlidersHorizontal } from "lucide-react";

import ViewerNav from "../../components/ViewerNav.jsx";
import { getRequest } from "../../api/client.js";

function formatDuration(sec) {
  const n = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;

  return h ? `${h}h ${m}m` : `${m}m ${s}s`;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[3px] border border-white/10 bg-[#17131a]">
      <div className="aspect-video bg-white/6" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 bg-white/6" />
        <div className="h-3 w-1/2 bg-white/4" />
      </div>
    </div>
  );
}

function VideoCard({ video }) {
  return (
    <Link
      to={`/viewer/videos/${video.id}`}
      className="group overflow-hidden rounded-[3px] border border-white/10 bg-[#17131a] transition hover:-translate-y-0.5 hover:border-(--gold)"
    >
      <div className="relative aspect-video overflow-hidden bg-[#0b090c]">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="grid h-full place-items-center text-(--mauve)">
            <Play />
          </div>
        )}

        <span className="absolute bottom-2 right-2 rounded-[3px] bg-black/80 px-2 py-1 font-(--font-mono) text-[0.6rem] text-(--parchment)">
          {formatDuration(video.durationSec)}
        </span>
      </div>

      <div className="p-4">
        <h3 className="truncate font-(--font-display) text-lg text-(--parchment)">
          {video.title}
        </h3>

        <div className="mt-2 flex flex-wrap gap-2 font-(--font-mono) text-[0.58rem] uppercase tracking-[0.06em] text-(--mauve)">
          {(video.genres || []).slice(0, 2).map((genre) => (
            <span key={genre}>{genre}</span>
          ))}
          <span>{video.views || 0} views</span>
        </div>
      </div>
    </Link>
  );
}

export default function ViewerHome() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [genre, setGenre] = useState(params.get("genre") || "");

  const [videos, setVideos] = useState([]);
  const [history, setHistory] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const search = query.trim();
      const path = search
        ? `/viewer/videos/search?q=${encodeURIComponent(search)}${
            genre ? `&genre=${encodeURIComponent(genre)}` : ""
          }`
        : `/viewer/videos${genre ? `?genre=${encodeURIComponent(genre)}` : ""}`;

      const feed = await getRequest(path);
      setVideos(feed.videos || []);

      try {
        const hist = await getRequest("/viewer/history?limit=6");
        setHistory((hist.videos || []).filter((video) => !video.completed));
      } catch {
        setHistory([]);
      }

      try {
        const genreData = await getRequest("/viewer/genres");
        setGenres(genreData.genres || []);
      } catch {
        setGenres([]);
      }
    } catch (err) {
      setError(err.message || "Unable to load films.");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [query, genre]);

  const title = useMemo(() => {
    if (query) return `Search results for “${query}”`;
    return genre || "Films currently playing";
  }, [query, genre]);

  function submit(event) {
    event.preventDefault();

    const next = new URLSearchParams();

    if (query.trim()) {
      next.set("q", query.trim());
    }

    if (genre) {
      next.set("genre", genre);
    }

    setParams(next);
  }

  function clearFilters() {
    setQuery("");
    setGenre("");
    setParams({});
  }

  return (
    <div className="min-h-screen bg-(--stage) text-(--parchment)">
      <ViewerNav />

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        <section className="mb-10 rounded-[3px] border border-(--gold)/20 bg-[linear-gradient(135deg,rgba(92,18,32,0.38),rgba(16,13,16,0.8))] p-6 lg:p-9">
          <p className="mb-2 font-(--font-mono) text-[0.62rem] uppercase tracking-[0.15em] text-(--gold)">
            The house is open
          </p>

          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <h1 className="max-w-2xl font-(--font-display) text-4xl leading-tight lg:text-5xl">
                Find your next film.
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-7 text-(--mauve)">
                Only films approved for public viewing appear here. Search by
                title or narrow the house by genre.
              </p>
            </div>

            <form
              onSubmit={submit}
              className="flex w-full max-w-xl gap-2"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[3px] border border-white/15 bg-(--stage)/70 px-3">
                <Search
                  size={18}
                  className="shrink-0 text-(--mauve)"
                />

                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search a video title…"
                  className="w-full bg-transparent py-3 text-sm text-(--parchment) outline-none placeholder:text-(--mauve)"
                />
              </div>

              <button
                type="submit"
                className="rounded-[3px] bg-(--gold) px-5 font-(--font-mono) text-[0.65rem] uppercase tracking-[0.08em] text-(--stage)"
              >
                Search
              </button>
            </form>
          </div>
        </section>

        {history.length > 0 && !query && !genre && (
          <section className="mb-12">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-(--font-mono) text-[0.6rem] uppercase tracking-[0.14em] text-(--gold)">
                  Pick up where you left off
                </p>

                <h2 className="mt-1 font-(--font-display) text-2xl">
                  Continue watching
                </h2>
              </div>

              <Link
                to="/viewer/history"
                className="font-(--font-mono) text-[0.62rem] uppercase text-(--mauve) hover:text-(--gold-soft)"
              >
                Full history
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {history.slice(0, 3).map((video) => (
                <Link
                  key={video.id}
                  to={`/viewer/videos/${video.id}`}
                  className="group relative overflow-hidden rounded-[3px] border border-white/10"
                >
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="aspect-video w-full object-cover opacity-80 transition group-hover:opacity-100"
                  />

                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black via-black/70 to-transparent p-4 pt-12">
                    <div className="flex items-center justify-between">
                      <h3 className="font-(--font-display) text-lg">
                        {video.title}
                      </h3>

                      <Clock3
                        size={16}
                        className="text-(--gold)"
                      />
                    </div>

                    <div className="mt-2 h-1 overflow-hidden rounded bg-white/10">
                      <div
                        className="h-full bg-(--gold)"
                        style={{
                          width: `${Math.min(
                            100,
                            (video.progress || 0) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-(--font-mono) text-[0.6rem] uppercase tracking-[0.14em] text-(--gold)">
                Discover
              </p>

              <h2 className="mt-1 font-(--font-display) text-3xl">
                {title}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal
                size={16}
                className="text-(--mauve)"
              />

              <select
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
                className="rounded-[3px] border border-white/10 bg-[#17131a] px-3 py-2 font-(--font-mono) text-[0.62rem] uppercase text-(--parchment) outline-none"
              >
                <option value="">All genres</option>

                {genres.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              {(query || genre) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-(--font-mono) text-[0.6rem] uppercase text-(--mauve) hover:text-(--gold-soft)"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-[3px] border border-(--error)/40 bg-(--error)/8 px-4 py-3 text-sm text-(--error)">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="rounded-[3px] border border-dashed border-white/10 px-6 py-16 text-center">
              <p className="font-(--font-display) text-2xl">
                No films found.
              </p>

              <p className="mt-2 text-sm text-(--mauve)">
                Try another title or clear the current filter.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}