import React, { useState } from "react";
import { Star, Trash2, Check, Sparkles, Film } from "lucide-react";
import { deleteRequest, postJson } from "../../../api/client.js";
import ConfirmDialog from "../../../components/ConfirmDialog.jsx";

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

export default function WatchSidePanel({
  video,
  videoId,
  onReviewSaved,
  onReviewDeleted,
}) {
  const myReview = video?.myReview || null;

  const [rating, setRating] = useState(myReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState(myReview?.text || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  if (!video?.hasWatched) {
    return (
      <aside className="watch-side-card">
        <div className="flex items-center gap-2 mb-3">
          <Film size={14} className="text-[#d9a653]" />
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#d9a653]">
            About this film
          </p>
        </div>

        <p className="text-[12px] leading-relaxed text-[#c2b6b9]">
          {video?.description || "No synopsis available for this film."}
        </p>

        {video?.genres?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {video.genres.map((g) => (
              <span
                key={g}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-[#a69aa0]"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-4">
          {[
            ["Director", video?.directorName || video?.director || "Independent"],
            ["Language", video?.language || "Original Audio"],
            ["Production", video?.productionCountry || "Independent"],
            ["Audience", video?.ageRestricted ? "18+ Mature" : "All Audiences"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between text-[11px]"
            >
              <span className="text-[#84787d]">{label}</span>
              <span className="font-medium text-[#e4dadc]">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
          <div className="flex items-center gap-2 text-[#d9a653]">
            <Sparkles size={13} />
            <span className="text-[10px] font-semibold">Viewer Reviewing</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-[#9a8d93]">
            Watch at least 80% of this film to unlock your community review and rating.
          </p>
        </div>
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
    setConfirmDelete(false);
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
  const activeRating = hoverRating || rating;

  return (
    <aside className="watch-side-card">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#d9a653]">
          {myReview ? "Your Review" : "Rate & Review"}
        </p>
        {myReview && (
          <span className="flex items-center gap-1 text-[9px] text-[#d9a653] font-medium bg-[#d9a653]/10 px-2 py-0.5 rounded-full border border-[#d9a653]/20">
            <Check size={11} /> Published
          </span>
        )}
      </div>

      {stats && (
        <p className="mt-1.5 text-[10px] text-[#84787d]">
          Watched on {fmtDate(stats.firstWatchedAt)}
          {stats.timesWatched > 1
            ? ` · ${stats.timesWatched}x total`
            : ""}
        </p>
      )}

      {/* Interactive Star Rating */}
      <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                type="button"
                onMouseEnter={() => setHoverRating(val)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(val)}
                className="p-1 transition transform hover:scale-110 focus:outline-none"
                aria-label={`Rate ${val} stars`}
              >
                <Star
                  size={22}
                  className={
                    val <= activeRating
                      ? "text-[#d9a653] drop-shadow-[0_0_8px_rgba(217,166,83,0.5)]"
                      : "text-[#4a4045]"
                  }
                  fill={val <= activeRating ? "currentColor" : "none"}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={rating || ""}
              placeholder="0.0"
              onChange={(e) => {
                const val = Math.min(5, Math.max(0, Number(e.target.value)));
                setRating(Number.isNaN(val) ? 0 : val);
              }}
              className="w-14 rounded-lg border border-white/10 bg-[#171216] px-2 py-1 text-center text-[12px] font-bold text-[#d9a653] outline-none focus:border-[#d9a653]"
            />
            <span className="text-[10px] text-[#695d63]">/ 5</span>
          </div>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={4}
        placeholder="What did you think of the cinematography, story, and direction?…"
        className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-[#171216] p-3 text-[11px] text-[#efe7da] placeholder-[#695d63] outline-none transition focus:border-[#d9a653] focus:ring-1 focus:ring-[#d9a653]/30"
      />

      {error && <p className="mt-2 text-[10px] text-[#e08a6b]">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={saving || !rating || !text.trim()}
          className="flex-1 rounded-xl bg-[#d9a653] hover:bg-[#e6b465] px-4 py-2.5 text-[11px] font-bold text-[#100d10] shadow-[0_4px_20px_rgba(217,166,83,0.25)] transition disabled:opacity-40 disabled:hover:bg-[#d9a653]"
        >
          {saving ? "Saving…" : myReview ? "Update Review" : "Publish Review"}
        </button>

        {myReview && (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#e08a6b]/30 text-[#e08a6b] hover:bg-[#e08a6b]/10 transition"
            title="Delete Review"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Review?"
        message="Are you sure you want to delete your review? This will also update the community average rating."
        confirmLabel="Delete Review"
        danger={true}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </aside>
  );
}