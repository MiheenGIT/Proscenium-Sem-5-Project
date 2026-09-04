import React, { useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { deleteRequest, postJson } from "../../../api/client.js";

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

export default function WatchSidePanel({ video, videoId, onReviewSaved, onReviewDeleted }) {
  const myReview = video?.myReview || null;

  const [rating, setRating] = useState(myReview?.rating || 0);
  const [text, setText] = useState(myReview?.text || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (!video?.hasWatched) {
    return (
      <aside className="h-max rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
        <p className="text-[9px] uppercase tracking-[.16em] text-[#d9a653]">
          About this film
        </p>

        <p className="mt-3 text-[12px] leading-6 text-[#b9aeb1]">
          {video?.description || "No description available."}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(video?.genres || []).map((g) => (
            <span
              key={g}
              className="rounded-full border border-white/10 px-3 py-1 text-[9px] text-[#9d9296]"
            >
              {g}
            </span>
          ))}
        </div>

        <div className="mt-5 grid gap-3">
          {[
            ["Language", video?.language || "Not specified"],
            ["Production", video?.productionCountry || "Not specified"],
            ["Audience", video?.ageRestricted ? "Mature" : "Standard"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-[10px]">
              <span className="text-[#756a6f]">{label}</span>
              <span className="text-[#d0c5c8]">{value}</span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[10px] leading-5 text-[#756a6f]">
          Watch at least 75% of this film to unlock reviewing.
        </p>
      </aside>
    );
  }

  async function save() {
    if (!rating || !text.trim()) return;

    setSaving(true);
    setError("");

    try {
      const review = await postJson(`/viewer/videos/${videoId}/reviews`, {
        rating,
        text: text.trim(),
      });

      onReviewSaved?.(review);
    } catch (err) {
      setError(err.message || "Unable to save review.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete your review?")) return;

    setDeleting(true);
    setError("");

    try {
      const data = await deleteRequest(`/viewer/videos/${videoId}/reviews`);
      setRating(0);
      setText("");
      onReviewDeleted?.(data);
    } catch (err) {
      setError(err.message || "Unable to delete review.");
    } finally {
      setDeleting(false);
    }
  }

  const stats = video?.watchStats;

  return (
    <aside className="h-max rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
      <p className="text-[9px] uppercase tracking-[.16em] text-[#d9a653]">
        {myReview ? "Your Review" : "Rate this film"}
      </p>

      {stats && (
        <p className="mt-2 text-[10px] leading-5 text-[#756a6f]">
          You watched this on {fmtDate(stats.firstWatchedAt)}
          {stats.timesWatched > 1
            ? ` · watched ${stats.timesWatched} times, most recently ${fmtDate(stats.lastWatchedAt)}`
            : ""}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={value <= Math.round(rating) ? "text-[#d9a653]" : "text-[#6e6368]"}
            >
              <Star size={20} fill="currentColor" />
            </button>
          ))}
        </div>

        <input
          type="number"
          min={0}
          max={5}
          step={0.01}
          value={rating || ""}
          onChange={(e) => {
            const value = Math.min(5, Math.max(0, Number(e.target.value)));
            setRating(Number.isNaN(value) ? 0 : value);
          }}
          className="w-16 rounded-lg border border-white/10 bg-[#171216] px-2 py-1 text-[11px] text-[#efe7da] outline-none focus:border-[#d9a653]"
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={5}
        placeholder="Write your review…"
        className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-[#171216] p-3 text-[11px] text-[#efe7da] outline-none focus:border-[#d9a653]"
      />

      {error && <p className="mt-2 text-[10px] text-[#e08a6b]">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={saving || !rating || !text.trim()}
          className="flex-1 rounded-xl bg-[#d9a653] px-4 py-2.5 text-[11px] font-bold text-[#100d10] disabled:opacity-45"
        >
          {saving ? "Saving…" : myReview ? "Update Review" : "Publish Review"}
        </button>

        {myReview && (
          <button
            onClick={remove}
            disabled={deleting}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#e08a6b]/40 text-[#e08a6b]"
            aria-label="Delete review"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </aside>
  );
}