import React, { useEffect, useMemo, useState } from "react";
import { Search, X, ArrowRight, Play, Film } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getRequest } from "../../api/client.js";

const FALLBACK_GENRES = [
  "Trending",
  "Movies",
  "Drama",
  "Action",
  "Comedy",
  "Romance",
  "Horror",
  "Thriller",
  "Sci-Fi",
  "Documentary",
];

function yearOf(video) {
  return (
    video?.releaseYear ||
    (video?.publishedAt
      ? new Date(video.publishedAt).getFullYear()
      : "")
  );
}

export default function SearchOverlay({ onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [genres, setGenres] = useState(FALLBACK_GENRES);

  useEffect(() => {
    const input = document.getElementById("proscenium-global-search");
    input?.focus();

    getRequest("/viewer/genres")
      .then((data) => {
        const apiGenres = Array.isArray(data?.genres) ? data.genres : [];
        if (apiGenres.length) {
          setGenres(["Trending", ...apiGenres].slice(0, 12));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const value = query.trim();

    if (!value) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await getRequest(
          `/viewer/videos/search?q=${encodeURIComponent(value)}&limit=20`
        );
        setResults(Array.isArray(data?.videos) ? data.videos : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const heading = useMemo(() => {
    if (!query.trim()) return "What do you want to watch today?";
    return `Search results for “${query.trim()}”`;
  }, [query]);

  function openVideo(id) {
    onClose?.();
    navigate(`/viewer/videos/${id}`);
  }

  function browseGenre(genre) {
    onClose?.();
    navigate(`/explore?genre=${encodeURIComponent(genre)}`);
  }

  return (
    <div className="fixed inset-0 left-[76px] z-[60] overflow-y-auto bg-[#10080b]/[0.985] text-[#efe7da] backdrop-blur-2xl max-lg:left-0">
      <div className="min-h-screen px-5 pb-16 pt-8 sm:px-8 lg:px-14 lg:pt-10">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="group flex items-center gap-3 text-left"
              aria-label="Close search"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-[#d9a653] transition group-hover:bg-[#5c1220]">
                <span className="font-[var(--font-display)] text-lg">P</span>
              </span>
              <span className="hidden font-[var(--font-display)] text-lg tracking-[0.14em] text-[#efe7da] sm:block">
                PROSCENIUM
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-[#b9adb1] transition hover:border-[#d9a653]/40 hover:text-[#efe7da]"
              aria-label="Close search"
            >
              <X size={18} />
            </button>
          </div>

          <section className="mx-auto mt-20 max-w-5xl text-center sm:mt-24">
            <p className="mb-4 text-[9px] font-bold uppercase tracking-[0.3em] text-[#d9a653]">
              Proscenium discovery
            </p>
            <h1 className="font-[var(--font-display)] text-4xl font-semibold leading-[0.98] tracking-[-0.035em] text-[#efe7da] sm:text-5xl lg:text-6xl">
              {heading}
            </h1>

            <div className="mx-auto mt-9 flex h-16 max-w-2xl items-center gap-4 rounded-full border border-[#d9a653]/55 bg-[#f4eee7] px-6 text-[#100d10] shadow-[0_0_0_5px_rgba(92,18,32,.25),0_25px_80px_rgba(0,0,0,.35)] transition focus-within:border-[#e6c184]">
              <Search size={21} className="shrink-0 text-[#5c1220]" />
              <input
                id="proscenium-global-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for movies, shows, genres..."
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#81777a] sm:text-lg"
                aria-label="Search Proscenium"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="grid h-8 w-8 place-items-center rounded-full bg-[#100d10]/10 text-[#5c1220] hover:bg-[#100d10]/15"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </section>

          {!query.trim() ? (
            <section className="mx-auto mt-16 max-w-6xl rounded-[28px] border border-[#d9a653]/15 bg-[#3c0c16]/45 p-6 shadow-[0_30px_100px_rgba(0,0,0,.2)] sm:mt-20 sm:p-9">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.24em] text-[#d9a653]">
                    Explore the library
                  </p>
                  <h2 className="mt-2 font-[var(--font-display)] text-2xl font-semibold text-[#efe7da] sm:text-3xl">
                    Handpicked for you
                  </h2>
                </div>
                <span className="hidden text-[9px] uppercase tracking-[0.18em] text-[#8b7c82] sm:block">
                  Browse by mood & genre
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {genres.map((genre, index) => (
                  <button
                    key={`${genre}-${index}`}
                    type="button"
                    onClick={() => browseGenre(genre)}
                    className={`shrink-0 rounded-full border px-5 py-3 text-[11px] font-semibold transition ${
                      index === 0
                        ? "border-[#efe7da] bg-transparent text-[#efe7da]"
                        : "border-white/10 bg-white/[0.055] text-[#d7cccf] hover:border-[#d9a653]/45 hover:bg-[#5c1220]/70 hover:text-[#efe7da]"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>

              <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                {[
                  "Trending now",
                  "New on Proscenium",
                  "Critics' picks",
                  "Continue watching",
                  "Your watchlist",
                ].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClose}
                    className="group flex min-h-28 items-end justify-between rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#5c1220]/80 to-[#171216] p-4 text-left transition hover:-translate-y-1 hover:border-[#d9a653]/35"
                  >
                    <span className="text-sm font-semibold text-[#efe7da]">{label}</span>
                    <ArrowRight size={16} className="text-[#d9a653] transition group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="mx-auto mt-14 max-w-6xl sm:mt-16">
              <div className="mb-6 flex items-center justify-between">
                <p className="text-[9px] uppercase tracking-[0.22em] text-[#8b7c82]">
                  {loading ? "Searching..." : `${results.length} titles found`}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[10px] font-semibold text-[#d9a653] hover:text-[#e6c184]"
                >
                  Back to home
                </button>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <div key={index} className="aspect-[16/10] animate-pulse rounded-2xl bg-white/[0.055]" />
                  ))}
                </div>
              ) : results.length ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
                  {results.map((video) => (
                    <article key={video.id} className="group min-w-0">
                      <button
                        type="button"
                        onClick={() => openVideo(video.id)}
                        className="relative block aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#171216] text-left transition duration-300 group-hover:-translate-y-1 group-hover:border-[#d9a653]/40"
                      >
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                        ) : (
                          <div className="grid h-full place-items-center text-[#8b7c82]"><Film size={30} /></div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                        <span className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center rounded-full bg-[#efe7da] text-[#100d10] opacity-0 transition group-hover:opacity-100">
                          <Play size={14} fill="currentColor" />
                        </span>
                      </button>
                      <h3 className="mt-3 truncate text-[13px] font-semibold text-[#efe7da]">{video.title || "Untitled"}</h3>
                      <p className="mt-1 truncate text-[10px] text-[#8b7c82]">
                        {[yearOf(video), ...(video.genres || []).slice(0, 2)].filter(Boolean).join(" • ")}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] px-6 py-20 text-center">
                  <Search className="mx-auto text-[#d9a653]" size={28} />
                  <h2 className="mt-4 font-[var(--font-display)] text-2xl text-[#efe7da]">No titles found</h2>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-[#8b7c82]">
                    Try a different movie name, genre, language, or keyword.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
