import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Film,
  Heart,
  MessageSquare,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { deleteRequest, getRequest } from "../../api/client.js";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import {
  EmptyState,
  PageLoading,
} from "../../components/common/States.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

export default function ViewerReviewsPro() {
  const nav = useNavigate();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");

  const [reviewToDelete, setReviewToDelete] = useState(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await getRequest("/viewer/reviews");
      setReviews(response?.reviews || []);
    } catch (err) {
      console.error("Failed to load reviews:", err);
      setError("Unable to load your reviews right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove() {
    if (!reviewToDelete) return;

    const review = reviewToDelete;
    setReviewToDelete(null);

    try {
      await deleteRequest(`/viewer/videos/${review.videoId}/reviews`);
      await load();
    } catch (err) {
      console.error("Failed to delete review:", err);
      setError("Unable to delete this review. Please try again.");
    }
  }

  const stats = useMemo(() => {
    const total = reviews.length;

    const average =
      total > 0
        ? reviews.reduce(
            (sum, review) => sum + Number(review.rating || 0),
            0
          ) / total
        : 0;

    const likes = reviews.reduce(
      (sum, review) => sum + Number(review.likes || 0),
      0
    );

    return {
      total,
      average,
      likes,
    };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();

    let result = reviews.filter((review) => {
      const matchesSearch =
        !query ||
        String(review.title || "")
          .toLowerCase()
          .includes(query) ||
        String(review.text || "")
          .toLowerCase()
          .includes(query);

      const matchesRating =
        ratingFilter === "all" ||
        Number(review.rating) === Number(ratingFilter);

      return matchesSearch && matchesRating;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === "highest") {
        return Number(b.rating || 0) - Number(a.rating || 0);
      }

      if (sortBy === "lowest") {
        return Number(a.rating || 0) - Number(b.rating || 0);
      }

      if (sortBy === "liked") {
        return Number(b.likes || 0) - Number(a.likes || 0);
      }

      return (
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
    });

    return result;
  }, [reviews, search, ratingFilter, sortBy]);

  function formatDate(value) {
    if (!value) return "Recently";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Recently";

    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function getRatingLabel(rating) {
    const value = Number(rating || 0);

    if (value === 5) return "Loved it";
    if (value === 4) return "Really liked it";
    if (value === 3) return "It was good";
    if (value === 2) return "Not for me";
    if (value === 1) return "Disliked it";

    return "Rated";
  }

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* =========================================================
            HEADER
        ========================================================= */}

        <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#121012] px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#d9a653]/[0.07] blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d9a653]/20 bg-[#d9a653]/[0.08]">
                  <Star
                    size={13}
                    className="text-[#d9a653]"
                    fill="currentColor"
                  />
                </div>

                <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-[#d9a653]">
                  Your cinema journal
                </p>
              </div>

              <h1 className="font-[var(--font-display)] text-4xl leading-tight text-[#efe7da] sm:text-5xl">
                My Reviews
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#968b90]">
                Keep track of the films you have rated and the thoughts you
                left behind.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#756a6f]">
              <MessageSquare size={14} />
              <span>
                {stats.total} {stats.total === 1 ? "review" : "reviews"}
              </span>
            </div>
          </div>
        </section>

        {/* =========================================================
            ERROR
        ========================================================= */}

        {error && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[#e08a6b]/20 bg-[#e08a6b]/[0.06] px-4 py-3">
            <p className="text-sm text-[#d9aaa0]">{error}</p>

            <button
              onClick={load}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-[#d7ced0] transition hover:bg-white/[0.08]"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        )}

        {/* =========================================================
            STATS
        ========================================================= */}

        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            icon={<MessageSquare size={16} />}
            label="Reviews"
            value={stats.total}
            detail="Films reviewed"
          />

          <StatCard
            icon={
              <Star
                size={16}
                fill="currentColor"
              />
            }
            label="Average rating"
            value={
              stats.total > 0
                ? stats.average.toFixed(1)
                : "—"
            }
            detail="Out of 5"
          />

          <StatCard
            icon={
              <Heart
                size={16}
                fill="currentColor"
              />
            }
            label="Likes received"
            value={stats.likes}
            detail="On your reviews"
          />
        </section>

        {/* =========================================================
            TOOLBAR
        ========================================================= */}

        {reviews.length > 0 && (
          <section className="mt-8">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Search */}
              <div className="relative w-full lg:max-w-md">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#70676b]"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your reviews..."
                  className="h-11 w-full rounded-xl border border-white/[0.07] bg-[#121012] pl-11 pr-10 text-sm text-[#e9e1d7] outline-none placeholder:text-[#625b5f] transition focus:border-[#d9a653]/30 focus:bg-[#151315]"
                />

                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71696c] transition hover:text-[#cfc5c7]"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {/* Rating filter */}
                <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-[#121012] p-1">
                  <FilterButton
                    active={ratingFilter === "all"}
                    onClick={() => setRatingFilter("all")}
                  >
                    All
                  </FilterButton>

                  {[5, 4, 3, 2, 1].map((rating) => (
                    <FilterButton
                      key={rating}
                      active={ratingFilter === String(rating)}
                      onClick={() => setRatingFilter(String(rating))}
                    >
                      <Star
                        size={11}
                        fill="currentColor"
                      />
                      {rating}
                    </FilterButton>
                  ))}
                </div>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-10 rounded-xl border border-white/[0.07] bg-[#121012] px-3 text-xs text-[#a79da0] outline-none transition focus:border-[#d9a653]/30"
                >
                  <option value="recent">Most Recent</option>
                  <option value="highest">Highest Rated</option>
                  <option value="lowest">Lowest Rated</option>
                  <option value="liked">Most Liked</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================
            REVIEWS
        ========================================================= */}

        {!reviews.length ? (
          <div className="mt-8">
            <EmptyState
              title="No reviews yet"
              message="Your ratings and reviews will appear here after you review a film."
            />
          </div>
        ) : !filteredReviews.length ? (
          <section className="mt-8 rounded-[24px] border border-white/[0.07] bg-[#121012] px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025]">
              <Search size={20} className="text-[#70676b]" />
            </div>

            <h2 className="mt-5 font-[var(--font-display)] text-2xl text-[#e7ded4]">
              No matching reviews
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#80767a]">
              Try a different search term or change your rating filter.
            </p>

            <button
              onClick={() => {
                setSearch("");
                setRatingFilter("all");
              }}
              className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2.5 text-xs text-[#c9c0c2] transition hover:bg-white/[0.07]"
            >
              Clear filters
            </button>
          </section>
        ) : (
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#665e62]">
                  Activity
                </p>

                <h2 className="mt-1 font-[var(--font-display)] text-xl text-[#e5dcd3]">
                  Your film reviews
                </h2>
              </div>

              <p className="text-xs text-[#665e62]">
                {filteredReviews.length} shown
              </p>
            </div>

            <div className="space-y-3">
              {filteredReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onWatch={() =>
                    nav(`/viewer/videos/${review.videoId}`)
                  }
                  onDelete={() => setReviewToDelete(review)}
                  formatDate={formatDate}
                  getRatingLabel={getRatingLabel}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* =========================================================
          DELETE CONFIRMATION
      ========================================================= */}

      <ConfirmDialog
        open={!!reviewToDelete}
        title="Delete Review?"
        message={
          reviewToDelete
            ? `Are you sure you want to delete your review for "${reviewToDelete.title || "this film"}"? This cannot be undone.`
            : "Are you sure you want to delete this review?"
        }
        confirmLabel="Delete Review"
        danger={true}
        onConfirm={remove}
        onCancel={() => setReviewToDelete(null)}
      />
    </DashboardLayout>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({ icon, label, value, detail }) {
  return (
    <div className="group rounded-2xl border border-white/[0.07] bg-[#121012] p-4 transition hover:border-white/[0.11] hover:bg-[#141214]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-[#696164]">
            {label}
          </p>

          <p className="mt-2 font-[var(--font-display)] text-2xl text-[#e9e0d6]">
            {value}
          </p>

          <p className="mt-1 text-[11px] text-[#6f676a]">
            {detail}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d9a653]/10 bg-[#d9a653]/[0.06] text-[#b58b4c] transition group-hover:border-[#d9a653]/20 group-hover:bg-[#d9a653]/[0.09]">
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   FILTER BUTTON
========================================================= */

function FilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] transition ${
        active
          ? "bg-[#e7dccd] text-[#171416]"
          : "text-[#81777b] hover:bg-white/[0.05] hover:text-[#cfc6c8]"
      }`}
    >
      {children}
    </button>
  );
}

/* =========================================================
   REVIEW CARD
========================================================= */

function ReviewCard({
  review,
  onWatch,
  onDelete,
  formatDate,
  getRatingLabel,
}) {
  const rating = Number(review.rating || 0);

  return (
    <article className="group overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#121012] transition duration-200 hover:border-white/[0.11] hover:bg-[#141214]">
      <div className="flex flex-col sm:flex-row">
        {/* Poster */}
        <button
          onClick={onWatch}
          className="relative h-52 w-full shrink-0 overflow-hidden bg-[#0d0c0e] text-left sm:h-auto sm:w-36 lg:w-40"
          aria-label={`Watch ${review.title || "film"}`}
        >
          {review.thumbnailUrl ? (
            <img
              src={review.thumbnailUrl}
              alt=""
              className="h-full min-h-[190px] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full min-h-[190px] w-full items-center justify-center">
              <Film
                size={28}
                strokeWidth={1.3}
                className="text-[#4f484b]"
              />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          <div className="absolute bottom-3 left-3 rounded-lg border border-white/[0.08] bg-black/50 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-white/75 backdrop-blur-md">
            Review
          </div>
        </button>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <button
                onClick={onWatch}
                className="group/title flex max-w-full items-center gap-2 text-left"
              >
                <h3 className="truncate font-[var(--font-display)] text-xl text-[#eee5da] transition group-hover/title:text-[#e6c184] sm:text-2xl">
                  {review.title || "Film"}
                </h3>

                <ArrowUpRight
                  size={15}
                  className="shrink-0 text-[#5e5659] opacity-0 transition group-hover/title:opacity-100"
                />
              </button>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#70676b]">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={12} />
                  {formatDate(review.updatedAt || review.createdAt)}
                </span>

                <span className="h-1 w-1 rounded-full bg-[#4d4749]" />

                <span>{getRatingLabel(rating)}</span>

                {review.moderationStatus &&
                  review.moderationStatus !== "approved" && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-[#4d4749]" />

                      <span className="capitalize text-[#8d7e72]">
                        {review.moderationStatus}
                      </span>
                    </>
                  )}
              </div>
            </div>

            {/* Delete */}
            <button
              onClick={onDelete}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent text-[#625b5e] opacity-100 transition hover:border-[#e08a6b]/15 hover:bg-[#e08a6b]/[0.06] hover:text-[#e08a6b]"
              title="Delete review"
              aria-label="Delete review"
            >
              <Trash2 size={15} />
            </button>
          </div>

          {/* Rating */}
          <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center gap-0.5 text-[#d9a653]">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={14}
                  fill={star <= rating ? "currentColor" : "none"}
                  className={
                    star <= rating
                      ? "text-[#d9a653]"
                      : "text-[#4b4447]"
                  }
                />
              ))}
            </div>

            <span className="text-xs font-medium text-[#c4b9b9]">
              {rating}/5
            </span>
          </div>

          {/* Review */}
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-[#a0989b]">
            {review.text || "You left a rating without written feedback."}
          </p>

          {/* Footer */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.055] pt-4">
            <div className="flex items-center gap-4 text-[11px] text-[#71696c]">
              <span className="inline-flex items-center gap-1.5">
                <Heart
                  size={13}
                  fill={Number(review.likes || 0) > 0 ? "currentColor" : "none"}
                />
                {Number(review.likes || 0)}{" "}
                {Number(review.likes || 0) === 1 ? "like" : "likes"}
              </span>

              <span className="inline-flex items-center gap-1.5">
                <MessageSquare size={13} />
                Your review
              </span>
            </div>

            <button
              onClick={onWatch}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3.5 py-2 text-[11px] text-[#bdb4b6] transition hover:border-[#d9a653]/20 hover:bg-[#d9a653]/[0.06] hover:text-[#e5c78e]"
            >
              Watch film
              <ArrowUpRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}