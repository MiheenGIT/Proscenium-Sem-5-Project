import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {ArrowLeft,Bookmark,Check,Heart,Play,Share2,Star,} from "lucide-react";
import { getRequest, postJson } from "../../api/client.js";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import MovieRow from "../../components/Dashboard/MovieRow.jsx";
import { ErrorState, PageLoading } from "../../components/common/States.jsx";

const n = (v) => Number(v || 0);

const mins = (s) => {
  s = Math.round(n(s));

  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);

  return h ? `${h}h ${m}m` : `${m}m`;
};

export default function MovieDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [v, setV] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [a, b, c] = await Promise.all([
        getRequest(`/viewer/videos/${id}`),
        getRequest(`/viewer/videos?limit=100`),
        getRequest(`/viewer/videos/${id}/reviews`),
      ]);

      setV(a);
      setSaved(Boolean(a.saved));
      setLiked(a.reaction === "like");

      setSimilar(
        (b.videos || [])
          .filter(
            (x) =>
              x.id !== id &&
              x.genres?.some((g) =>
                a.genres?.map((z) => z.toLowerCase()).includes(g.toLowerCase())
              )
          )
          .slice(0, 12)
      );

      setReviews(c.reviews || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function save() {
    try {
      const d = await postJson(`/viewer/videos/${id}/watchlist`, {
        saved: !saved,
      });

      setSaved(Boolean(d.saved));
    } catch (e) {
      setError(e.message);
    }
  }

  async function like() {
    try {
      const d = await postJson(`/viewer/videos/${id}/react`, {
        type: "like",
      });

      setLiked(d.reaction === "like");

      setV((x) => ({
        ...x,
        likes: d.likes,
        dislikes: d.dislikes,
        reaction: d.reaction,
      }));
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading />
      </DashboardLayout>
    );
  }

  if (error || !v) {
    return (
      <DashboardLayout>
        <main className="p-8">
          <ErrorState message={error || "Film not found"} />
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="min-w-0 overflow-hidden">
        <section className="relative min-h-135 overflow-hidden">
          <img
            src={v.thumbnailUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-[linear-gradient(90deg,#100d10_0%,rgba(16,13,16,.82)_35%,rgba(16,13,16,.25)_75%,#100d10_100%)]" />

          <div className="absolute inset-0 bg-gradient-to-t from-[#100d10] via-transparent to-[#100d10]/20" />

          <div className="relative flex min-h-135 items-end px-5 pb-12 sm:px-10 lg:px-12">
            <div className="max-w-3xl">
              <button
                onClick={() => nav(-1)}
                className="mb-8 inline-flex items-center gap-2 text-[10px] uppercase tracking-[.16em] text-[#9a8e93] hover:text-[#efe7da]"
              >
                <ArrowLeft size={13} />
                Back
              </button>

              <h1 className="font-[var(--font-display)] text-4xl font-semibold text-[#f5eee5] sm:text-6xl">
                {v.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-[#b5a9ad]">
                <span>{v.releaseYear || ""}</span>
                <span>•</span>
                <span>{mins(v.durationSec)}</span>

                {v.language && (
                  <>
                    <span>•</span>
                    <span>{v.language}</span>
                  </>
                )}

                {v.ageRestricted && (
                  <span className="border border-white/15 px-1.5 py-0.5">
                    18+
                  </span>
                )}

                <span className="flex items-center gap-1 text-[#d9a653]">
                  <Star size={11} fill="currentColor" />
                  {n(v.avgRating).toFixed(1)} ({v.reviewCount || 0})
                </span>
              </div>

              <p className="mt-5 max-w-2xl text-sm leading-6 text-[#c3b8bb]">
                {v.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {(v.genres || []).map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-white/10 px-3 py-1 text-[9px] text-[#c6bbbe]"
                  >
                    {g}
                  </span>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  onClick={() => nav(`/viewer/videos/${id}`)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#d9a653] px-5 py-3 text-xs font-bold text-[#100d10]"
                >
                  <Play size={15} fill="currentColor" />
                  Watch Now
                </button>

                <button
                  onClick={save}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-[#efe7da]"
                >
                  {saved ? <Check size={15} /> : <Bookmark size={15} />}
                  {saved ? "Saved" : "Watchlist"}
                </button>

                <button
                  onClick={like}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${
                    liked
                      ? "border-[#d9a653]/40 text-[#d9a653]"
                      : "border-white/10 text-[#efe7da]"
                  }`}
                >
                  <Heart
                    size={15}
                    fill={liked ? "currentColor" : "none"}
                  />
                  {v.likes || 0}
                </button>

                <button
                  onClick={() =>
                    navigator.share?.({
                      title: v.title,
                      url: window.location.href,
                    })
                  }
                  className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-black/25 text-[#efe7da]"
                  aria-label="Share"
                >
                  <Share2 size={15} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-10 sm:px-10 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <div>
              <h2 className="font-[var(--font-display)] text-2xl text-[#efe7da]">
                About this film
              </h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["Language", v.language || "Not specified"],
                  ["Runtime", mins(v.durationSec) || "Not specified"],
                  ["Audience", v.ageRestricted ? "Mature" : "Standard"],
                  ["Production", v.productionCountry || "Not specified"],
                ].map(([a, b]) => (
                  <div
                    key={a}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"
                  >
                    <p className="text-[8px] uppercase tracking-[.16em] text-[#756a6f]">
                      {a}
                    </p>
                    <p className="mt-2 text-xs text-[#d0c5c8]">{b}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-[var(--font-display)] text-2xl text-[#efe7da]">
                Reviews
              </h2>

              <div className="mt-4 space-y-3">
                {reviews.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-[#ddd2d5]">
                        {r.viewerUsername}
                      </span>

                      <span className="flex text-[#d9a653]">
                        {Array.from({ length: r.rating }, (_, i) => (
                          <Star
                            key={i}
                            size={10}
                            fill="currentColor"
                          />
                        ))}
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] leading-5 text-[#9a8e93]">
                      {r.text}
                    </p>
                  </div>
                ))}

                {!reviews.length && (
                  <p className="text-xs text-[#756a6f]">
                    No reviews yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <MovieRow
          title="You may also like"
          videos={similar}
          onPlay={(x) => nav(`/viewer/videos/${x.id}`)}
        />
      </main>
    </DashboardLayout>
  );
}