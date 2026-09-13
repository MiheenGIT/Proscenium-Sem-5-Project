import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Film,
  Filter,
  Heart,
  MessageSquare,
  Play,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  User,
} from "lucide-react";
import { getRequest, postJson } from "../../api/client.js";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import { EmptyState, ErrorState, PageLoading } from "../../components/common/States.jsx";

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const num = (v) => Number(v || 0);

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function formatDuration(sec) {
  if (!sec) return null;
  const s = Math.round(Number(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function StarRating({ rating, size = 14, className = "text-[#d9a653]" }) {
  const r = Math.max(0, Math.min(5, Number(rating || 0)));
  const fullStars = Math.floor(r);
  const hasHalf = r - fullStars >= 0.5;

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const isFull = i <= fullStars;
        const isHalf = i === fullStars + 1 && hasHalf;
        return (
          <span key={i} className="relative inline-block">
            <Star
              size={size}
              className={isFull ? "fill-current text-[#d9a653]" : "text-white/20"}
            />
          </span>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                     VIEW A: POSTER GRID / BROWSE                           */
/* -------------------------------------------------------------------------- */

function PosterGridView({ onSelectFilm }) {
  const [films, setFilms] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState("reviews");
  const [genresList, setGenresList] = useState([]);

  async function loadCatalog() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (genre) params.append("genre", genre);
      if (sort) params.append("sort", sort);
      if (search.trim()) params.append("search", search.trim());
      params.append("limit", "48");

      const [catalogData, genresData] = await Promise.all([
        getRequest(`/viewer/reviews/catalog?${params.toString()}`),
        genresList.length ? Promise.resolve(null) : getRequest("/viewer/genres"),
      ]);

      setFilms(catalogData?.films || []);
      setTotalCount(catalogData?.count || 0);

      if (genresData?.genres) {
        setGenresList(genresData.genres);
      }
    } catch (err) {
      setError(err.message || "Failed to load film review catalog.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCatalog();
    }, 200);
    return () => clearTimeout(timer);
  }, [genre, sort, search]);

  return (
    <div className="space-y-8">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/[0.06] pb-8">
        <div>
          <div className="flex items-center gap-2 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.2em] text-[#d9a653]">
            <Film size={13} />
            <span>Community Film Vault</span>
          </div>
          <h1 className="mt-2 font-[var(--font-display)] text-3xl sm:text-4xl lg:text-5xl text-[#efe7da] font-normal tracking-tight">
            Film Reviews & Reception
          </h1>
          <p className="mt-2 text-xs text-[#9c8e94] max-w-xl">
            Browse through audience critiques, logs, and star ratings across the Proscenium library. Select any film poster to explore its full review ledger.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-4 font-[var(--font-mono)] text-[0.72rem] text-[#9c8e94]">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-center">
            <span className="block font-bold text-[#efe7da] text-base">{totalCount}</span>
            <span className="text-[0.62rem] uppercase tracking-wider text-[#756a6f]">Films Cataloged</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#756a6f]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search films by title…"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.025] pl-9 pr-4 py-2 text-xs text-[#efe7da] placeholder-[#756a6f] outline-none transition focus:border-[#d9a653]/50 focus:bg-white/[0.04]"
          />
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal size={13} className="text-[#756a6f]" />
          <span className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-wider text-[#756a6f]">
            Sort:
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-white/[0.08] bg-[#140f14] px-3 py-1.5 font-[var(--font-mono)] text-xs text-[#efe7da] outline-none transition focus:border-[#d9a653]/50"
          >
            <option value="reviews">Most Reviewed</option>
            <option value="rating">Highest Rated</option>
            <option value="recent">Recently Added</option>
            <option value="title">Alphabetical (A–Z)</option>
          </select>
        </div>
      </div>

      {/* Genre Pills */}
      {genresList.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setGenre("")}
            className={`shrink-0 rounded-full border px-3.5 py-1 text-[11px] transition ${
              !genre
                ? "border-[#d9a653] bg-[#5c1220] text-[#e6c184]"
                : "border-white/10 bg-white/[0.02] text-[#968b8f] hover:text-[#efe7da]"
            }`}
          >
            All Genres
          </button>
          {genresList.map((g) => (
            <button
              key={g}
              onClick={() => setGenre(g === genre ? "" : g)}
              className={`shrink-0 rounded-full border px-3.5 py-1 text-[11px] transition ${
                genre.toLowerCase() === g.toLowerCase()
                  ? "border-[#d9a653] bg-[#5c1220] text-[#e6c184]"
                  : "border-white/10 bg-white/[0.02] text-[#968b8f] hover:text-[#efe7da]"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Film Posters Grid (Letterboxd Style) */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 pt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-white/[0.03] border border-white/[0.05]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadCatalog} />
      ) : !films.length ? (
        <EmptyState
          title="No Films Found"
          message="No films match your search or genre filter. Try adjusting your selections."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 pt-2">
          {films.map((film) => (
            <div
              key={film.id}
              onClick={() => onSelectFilm(film.id)}
              className="group relative cursor-pointer flex flex-col transition duration-300 hover:-translate-y-1.5"
            >
              {/* Poster Frame (Letterboxd Style aspect ratio) */}
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#171216] shadow-md transition duration-300 group-hover:border-[#d9a653]/60 group-hover:shadow-[0_12px_30px_rgba(0,0,0,0.6)]">
                {film.thumbnailUrl ? (
                  <img
                    src={film.thumbnailUrl}
                    alt={film.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#1c161f] p-4 text-center">
                    <span className="font-[var(--font-display)] text-xs text-[#9c8e94]">{film.title}</span>
                  </div>
                )}

                {/* Ambient Top Vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-80 transition group-hover:opacity-95" />

                {/* Score badge at top right */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-md border border-white/10 bg-black/70 px-2 py-0.5 backdrop-blur-md">
                  <Star size={10} className="fill-[#d9a653] text-[#d9a653]" />
                  <span className="font-[var(--font-mono)] text-[0.68rem] font-bold text-[#efe7da]">
                    {film.avgRating > 0 ? Number(film.avgRating).toFixed(1) : "—"}
                  </span>
                </div>

                {/* Bottom Overlay Info */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between font-[var(--font-mono)] text-[0.65rem] text-[#9c8e94]">
                  <span className="inline-flex items-center gap-1 text-[#d9a653]">
                    <MessageSquare size={11} />
                    <span>{film.reviewCount || 0} reviews</span>
                  </span>
                  {film.releaseYear && <span>{film.releaseYear}</span>}
                </div>
              </div>

              {/* Title & Genre Subtitle */}
              <div className="mt-2.5 px-0.5">
                <h3 className="truncate font-medium text-xs text-[#efe7da] group-hover:text-[#e6c184] transition-colors">
                  {film.title}
                </h3>
                <p className="truncate font-[var(--font-mono)] text-[0.62rem] text-[#756a6f] uppercase tracking-wider">
                  {film.genres?.[0] || "Cinema"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                   VIEW B: PER-FILM FULL REVIEW STREAM                      */
/* -------------------------------------------------------------------------- */

function FilmReviewListView({ filmId, onBack }) {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sort, setSort] = useState("rating_desc");
  const [ratingFilter, setRatingFilter] = useState(null);
  const [page, setPage] = useState(1);

  async function loadFilmReviews() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (sort) params.append("sort", sort);
      if (ratingFilter !== null) params.append("rating", ratingFilter);
      params.append("page", String(page));
      params.append("limit", "30");

      const res = await getRequest(`/viewer/videos/${filmId}/reviews?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load film reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFilmReviews();
  }, [filmId, sort, ratingFilter, page]);

  async function toggleLike(reviewId) {
    try {
      const res = await postJson(`/viewer/videos/${filmId}/reviews/${reviewId}/like`);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          reviews: prev.reviews.map((r) =>
            r.id === reviewId ? { ...r, liked: res.liked, likes: res.likes } : r
          ),
        };
      });
    } catch (err) {
      console.error("Like toggle failed", err);
    }
  }

  const film = data?.film;
  const distribution = data?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalReviews = data?.total || 0;

  return (
    <div className="space-y-10">
      {/* Back button */}
      <button
        onClick={onBack}
        className="group inline-flex items-center gap-2 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.16em] text-[#9c8e94] transition hover:text-[#efe7da]"
      >
        <ArrowLeft size={13} className="transition group-hover:-translate-x-1" />
        <span>Return to All Films</span>
      </button>

      {/* Film Header Banner & Score Distribution */}
      {film && (
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#140f15]/80 p-6 sm:p-8 backdrop-blur-md">
          {film.thumbnailUrl && (
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-cover bg-center opacity-10 blur-3xl"
              style={{ backgroundImage: `url(${film.thumbnailUrl})` }}
            />
          )}

          <div className="relative z-10 flex flex-col lg:flex-row gap-8 items-start justify-between">
            {/* Left: Poster + Meta */}
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Poster */}
              <div className="relative w-32 sm:w-40 shrink-0 aspect-[2/3] overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl">
                {film.thumbnailUrl ? (
                  <img src={film.thumbnailUrl} alt={film.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-[#756a6f]">
                    {film.title}
                  </div>
                )}
              </div>

              {/* Title & Metadata */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 font-[var(--font-mono)] text-[0.68rem] text-[#9c8e94]">
                  {film.releaseYear && <span>{film.releaseYear}</span>}
                  {film.durationSec ? (
                    <>
                      <span>•</span>
                      <span>{formatDuration(film.durationSec)}</span>
                    </>
                  ) : null}
                  {film.genres?.length > 0 && (
                    <>
                      <span>•</span>
                      <span>{film.genres.join(", ")}</span>
                    </>
                  )}
                </div>

                <h1 className="font-[var(--font-display)] text-3xl sm:text-4xl text-[#efe7da] font-normal tracking-tight">
                  {film.title}
                </h1>

                {film.description && (
                  <p className="max-w-xl text-xs sm:text-sm text-[#b5a6ac] leading-relaxed line-clamp-3">
                    {film.description}
                  </p>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => navigate(`/viewer/videos/${filmId}`)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#d9a653] px-4 py-2 font-[var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-black transition hover:bg-[#e6c184]"
                  >
                    <Play size={13} fill="currentColor" />
                    <span>Watch Film</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Score Breakdown & Letterboxd Histogram */}
            <div className="w-full lg:w-72 shrink-0 rounded-xl border border-white/[0.06] bg-black/40 p-5 space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="font-[var(--font-display)] text-4xl text-[#efe7da] font-medium">
                    {film.avgRating > 0 ? Number(film.avgRating).toFixed(1) : "0.0"}
                  </span>
                  <span className="text-xs text-[#756a6f]"> / 5.0</span>
                </div>
                <div className="text-right">
                  <StarRating rating={film.avgRating} size={15} />
                  <p className="font-[var(--font-mono)] text-[0.62rem] uppercase tracking-wider text-[#756a6f] mt-0.5">
                    {totalReviews} {totalReviews === 1 ? "Review" : "Reviews"} Total
                  </p>
                </div>
              </div>

              {/* Star Distribution Histogram */}
              <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                {[5, 4, 3, 2, 1].map((starCount) => {
                  const count = distribution[String(starCount)] || 0;
                  const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                  const isSelected = ratingFilter === starCount;

                  return (
                    <button
                      key={starCount}
                      onClick={() => setRatingFilter(isSelected ? null : starCount)}
                      className={`group flex w-full items-center gap-2 font-[var(--font-mono)] text-[0.65rem] transition ${
                        isSelected ? "text-[#d9a653] font-bold" : "text-[#8a7d83] hover:text-[#efe7da]"
                      }`}
                    >
                      <span className="w-4 text-right">{starCount}★</span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isSelected ? "bg-[#d9a653]" : "bg-[#d9a653]/60 group-hover:bg-[#d9a653]"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-[0.6rem] text-[#756a6f]">{count}</span>
                    </button>
                  );
                })}
              </div>

              {ratingFilter !== null && (
                <button
                  onClick={() => setRatingFilter(null)}
                  className="w-full text-center font-[var(--font-mono)] text-[0.62rem] uppercase tracking-wider text-[#d9a653] hover:underline"
                >
                  Clear Star Filter ({ratingFilter}★)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review Stream Filters & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-[#d9a653]" />
          <h2 className="font-[var(--font-display)] text-xl text-[#efe7da]">
            Review Ledger
          </h2>
          <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 font-[var(--font-mono)] text-[0.65rem] text-[#9c8e94]">
            {data?.count ?? 0} shown
          </span>
        </div>

        {/* Filter / Sort dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 font-[var(--font-mono)] text-xs text-[#9c8e94]">
            <span className="text-[0.65rem] uppercase tracking-wider text-[#756a6f]">Sort by:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl border border-white/[0.08] bg-[#140f14] px-3 py-1.5 font-[var(--font-mono)] text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/50"
            >
              <option value="rating_desc">Highest Rating</option>
              <option value="rating_asc">Lowest Rating</option>
              <option value="recent">Most Recent</option>
              <option value="oldest">Earliest Logged</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/[0.025] border border-white/[0.06]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadFilmReviews} />
      ) : !data?.reviews?.length ? (
        <EmptyState
          title="No Reviews Recorded"
          message={
            ratingFilter
              ? `No ${ratingFilter}-star reviews found for this film.`
              : "Be the first to watch and review this film."
          }
        />
      ) : (
        <div className="space-y-4">
          {data.reviews.map((rev) => (
            <article
              key={rev.id}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6 transition hover:border-white/[0.14] hover:bg-white/[0.03]"
            >
              {/* Top Row: User Avatar, Handle, Star Rating & Date */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#1f1722] grid place-items-center">
                    {rev.viewerAvatarUrl ? (
                      <img src={rev.viewerAvatarUrl} alt={rev.viewerUsername} className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-[var(--font-mono)] text-xs font-bold text-[#d9a653]">
                        {rev.viewerUsername ? rev.viewerUsername.charAt(0).toUpperCase() : "V"}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[#efe7da]">{rev.viewerUsername}</span>
                      <span className="rounded bg-white/[0.05] px-1.5 py-0.2 font-[var(--font-mono)] text-[0.6rem] uppercase tracking-wider text-[#756a6f]">
                        Verified Viewer
                      </span>
                    </div>

                    <div className="mt-0.5 flex items-center gap-2 font-[var(--font-mono)] text-[0.65rem] text-[#756a6f]">
                      <span>{formatDate(rev.createdAt || rev.updatedAt)}</span>
                      {rev.updatedAt && rev.createdAt && rev.updatedAt !== rev.createdAt && (
                        <span>• edited</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Star Score Pill */}
                <div className="flex flex-col items-end">
                  <StarRating rating={rev.rating} size={14} />
                  <span className="font-[var(--font-mono)] text-[0.68rem] font-bold text-[#d9a653] mt-0.5">
                    {Number(rev.rating).toFixed(1)} / 5
                  </span>
                </div>
              </div>

              {/* Review Full Text */}
              <p className="mt-4 text-sm text-[#d4c8cc] leading-relaxed whitespace-pre-line font-light">
                {rev.text}
              </p>

              {/* Bottom Actions & Meta */}
              <div className="mt-4 pt-3.5 border-t border-white/[0.04] flex items-center justify-between text-xs text-[#756a6f]">
                <div className="font-[var(--font-mono)] text-[0.62rem] uppercase tracking-wider text-[#63575d]">
                  Status: {rev.moderationStatus || "visible"}
                </div>

                <button
                  type="button"
                  onClick={() => toggleLike(rev.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 font-[var(--font-mono)] text-xs transition ${
                    rev.liked
                      ? "border-[#d9a653]/40 bg-[#d9a653]/10 text-[#d9a653]"
                      : "border-white/[0.08] bg-white/[0.02] text-[#8a7d83] hover:text-[#efe7da] hover:border-white/20"
                  }`}
                >
                  <Heart size={12} fill={rev.liked ? "currentColor" : "none"} />
                  <span>{rev.likes || 0}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               MAIN PAGE WRAPPER                            */
/* -------------------------------------------------------------------------- */

export default function FilmReviewsPage() {
  const { id: paramFilmId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeFilmId = paramFilmId || searchParams.get("filmId") || null;

  function handleSelectFilm(filmId) {
    navigate(`/film-reviews/${filmId}`);
  }

  function handleBackToCatalog() {
    navigate("/film-reviews");
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
        {activeFilmId ? (
          <FilmReviewListView filmId={activeFilmId} onBack={handleBackToCatalog} />
        ) : (
          <PosterGridView onSelectFilm={handleSelectFilm} />
        )}
      </main>
    </DashboardLayout>
  );
}
