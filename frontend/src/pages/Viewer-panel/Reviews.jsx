import React, { useEffect, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { deleteRequest, getRequest } from "../../api/client.js";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import {EmptyState,PageLoading,} from "../../components/common/States.jsx";

export default function ViewerReviewsPro() {
  const nav = useNavigate();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    try {
      setReviews((await getRequest("/viewer/reviews")).reviews || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(r) {
    if (!window.confirm("Delete this review?")) return;

    try {
      await deleteRequest(`/viewer/videos/${r.videoId}/reviews`);
      load();
    } catch {}
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
      <main className="mx-auto max-w-4xl px-5 py-10 lg:px-8">
        <p className="text-[9px] uppercase tracking-[.22em] text-[#d9a653]">
          Your cinema
        </p>

        <h1 className="mt-2 font-[var(--font-display)] text-4xl text-[#efe7da]">
          My Reviews
        </h1>

        {!reviews.length ? (
          <div className="mt-8">
            <EmptyState
              title="No reviews yet"
              message="Your ratings and reviews will appear here after you review a film."
            />
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {reviews.map((r) => (
              <article
                key={r.id}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <button
                    onClick={() => nav(`/viewer/videos/${r.videoId}`)}
                    className="font-[var(--font-display)] text-lg text-[#efe7da] hover:text-[#e6c184]"
                  >
                    {r.title || "Film"}
                  </button>

                  <div className="flex items-center gap-1 text-[#d9a653]">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={12}
                        fill={i <= r.rating ? "currentColor" : "none"}
                      />
                    ))}
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-[#b1a5a9]">
                  {r.text}
                </p>

                <div className="mt-4 flex items-center justify-between text-[9px] text-[#756a6f]">
                  <span>
                    {r.updatedAt &&
                      new Date(r.updatedAt).toLocaleDateString()}
                  </span>

                  <button
                    onClick={() => remove(r)}
                    className="inline-flex items-center gap-1 text-[#8f8388] hover:text-[#e08a6b]"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}