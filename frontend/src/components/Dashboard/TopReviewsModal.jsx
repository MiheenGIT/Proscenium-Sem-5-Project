import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MessageSquare, Play, Star, X } from "lucide-react";
import { getRequest } from "../../api/client.js";

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

export default function TopReviewsModal({ video, onClose, onPlay }) {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!video?.id) return;
    let cancelled = false;

    setLoading(true);
    setError("");

    getRequest(`/viewer/videos/${video.id}/reviews/top?limit=5`)
      .then((res) => {
        if (!cancelled) {
          setReviews(res?.reviews || []);
          setTotal(res?.total || 0);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Unable to load reviews.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [video?.id]);

  if (!video) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#140f16] shadow-2xl">
        
        {/* Modal Header with Poster Strip */}
        <div className="relative border-b border-white/[0.08] bg-[#1a131c] p-5 sm:p-6">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/[0.05] text-[#9c8e94] transition hover:bg-white/10 hover:text-[#efe7da]"
          >
            <X size={15} />
          </button>

          <div className="flex gap-4 items-center">
            <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black">
              {video.thumbnailUrl ? (
                <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[8px] text-[#756a6f]">Film</div>
              )}
            </div>

            <div className="min-w-0 pr-8">
              <span className="font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.18em] text-[#d9a653]">
                Top Community Reception
              </span>
              <h3 className="truncate font-[var(--font-display)] text-xl text-[#efe7da]">
                {video.title}
              </h3>
              <div className="mt-1 flex items-center gap-2 font-[var(--font-mono)] text-[0.68rem] text-[#9c8e94]">
                <span className="flex items-center gap-1 font-bold text-[#d9a653]">
                  <Star size={11} fill="currentColor" />
                  {video.avgRating > 0 ? Number(video.avgRating).toFixed(1) : "—"}
                </span>
                <span>•</span>
                <span>{total} total reviews logged</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews List Content (Top 5) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 [scrollbar-width:thin]">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.03] border border-white/[0.05]" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400">
              {error}
            </div>
          ) : !reviews.length ? (
            <div className="py-8 text-center text-xs text-[#756a6f]">
              No reviews published yet for this film.
            </div>
          ) : (
            reviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#1c1520] grid place-items-center text-[10px] font-bold text-[#d9a653]">
                      {rev.viewerAvatarUrl ? (
                        <img src={rev.viewerAvatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        rev.viewerUsername?.[0]?.toUpperCase() || "V"
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#efe7da] leading-tight">{rev.viewerUsername}</p>
                      <p className="font-[var(--font-mono)] text-[0.6rem] text-[#756a6f]">{formatDate(rev.createdAt || rev.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 font-[var(--font-mono)] text-xs font-bold text-[#d9a653]">
                    <Star size={11} fill="currentColor" />
                    <span>{Number(rev.rating).toFixed(1)}</span>
                  </div>
                </div>

                <p className="mt-2.5 text-xs text-[#b8abb0] leading-relaxed line-clamp-3 font-light">
                  {rev.text}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer with Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.08] bg-[#18121a] p-4">
          <button
            onClick={() => {
              onClose();
              navigate(`/film-reviews/${video.id}`);
            }}
            className="group inline-flex items-center gap-2 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-wider text-[#d9a653] transition hover:text-[#e6c184]"
          >
            <span>Read all {total} reviews on Letterboxd page</span>
            <ArrowRight size={12} className="transition group-hover:translate-x-1" />
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                onClose();
                onPlay?.(video);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#d9a653] px-4 py-2 font-[var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-black transition hover:bg-[#e6c184]"
            >
              <Play size={12} fill="currentColor" />
              <span>Watch Now</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
