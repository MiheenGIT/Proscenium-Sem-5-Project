import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getRequest } from "../../api/client";

// Change this if your director analytics page lives on a different route.
const ANALYTICS_PATH = "/director/analytics";

const num = (value) => Number(value || 0).toLocaleString("en-IN");

function formatMinutes(total) {
  const m = Math.round(Number(total) || 0);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatClock(sec) {
  if (!sec) return "—";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/* ------------------------------ small pieces ------------------------------ */

function Stars({ rating, className = "text-sm" }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <span
      className={`relative inline-block leading-none ${className}`}
      aria-label={`${value.toFixed(1)} out of 5`}
    >
      <span className="text-white/15">★★★★★</span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-[var(--gold)]"
        style={{ width: `${(value / 5) * 100}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}

function StatTile({ label, value, note }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.018] p-3.5">
      <p className="font-[var(--font-mono)] text-[0.58rem] uppercase tracking-[0.14em] text-[var(--mauve)]">
        {label}
      </p>
      <p className="mt-1.5 font-[var(--font-display)] text-2xl text-[var(--parchment)]">
        {value}
      </p>
      {note ? (
        <p className="mt-0.5 text-[0.68rem] leading-snug text-[var(--mauve)]">{note}</p>
      ) : null}
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5">
      <h3 className="font-[var(--font-mono)] text-[0.66rem] uppercase tracking-[0.16em] text-[var(--gold)]">
        {title}
      </h3>
      {subtitle ? <p className="mt-1 text-xs text-[var(--mauve)]">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Avatar({ url, name, size = "h-9 w-9", text = "text-xs" }) {
  return (
    <div className={`${size} shrink-0 overflow-hidden rounded-full border border-white/[0.1] bg-white/[0.04]`}>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className={`grid h-full w-full place-items-center ${text} text-[var(--gold-soft)]`}>
          {name?.charAt(0)?.toUpperCase() || "V"}
        </div>
      )}
    </div>
  );
}

// Long ranges are summed into ~10 buckets so nothing is dropped from the chart.
function MiniBars({ rows, valueKey, labelKey, empty }) {
  const hasData = rows?.some((r) => Number(r[valueKey] || 0) > 0);
  if (!hasData) {
    return <p className="py-10 text-center text-xs text-[var(--mauve)]">{empty}</p>;
  }

  const step = rows.length > 12 ? Math.ceil(rows.length / 10) : 1;
  const grouped = [];
  for (let i = 0; i < rows.length; i += step) {
    const chunk = rows.slice(i, i + step);
    const first = chunk[0][labelKey];
    const last = chunk[chunk.length - 1][labelKey];
    grouped.push({
      label: first,
      title: chunk.length > 1 ? `${first} – ${last}` : first,
      value: chunk.reduce((sum, r) => sum + Number(r[valueKey] || 0), 0),
    });
  }
  const max = Math.max(1, ...grouped.map((g) => g.value));

  return (
    <div>
      <div className="flex h-36 items-end gap-1.5">
        {grouped.map((g, i) => (
          <div
            key={`${g.label}-${i}`}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${g.title}: ${num(g.value)}`}
          >
            <div
              className="w-full rounded-t bg-[var(--gold)]/70 transition-all hover:bg-[var(--gold)]"
              style={{ height: `${Math.max(3, (g.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {grouped.map((g, i) => (
          <span
            key={`${g.label}-${i}`}
            className="min-w-0 flex-1 truncate text-center font-[var(--font-mono)] text-[0.52rem] text-[var(--mauve)]"
          >
            {g.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SentimentBar({ sentiment }) {
  const { positive = 0, negative = 0, neutral = 0 } = sentiment || {};
  const total = positive + negative + neutral;
  if (!total) return null;

  const seg = (n, cls) =>
    n ? <div className={cls} style={{ width: `${(n / total) * 100}%` }} /> : null;

  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
        {seg(positive, "bg-[#7ad399]")}
        {seg(neutral, "bg-white/30")}
        {seg(negative, "bg-[var(--error)]")}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem] text-[var(--mauve)]">
        <span><span className="text-[#9ee2b7]">{positive}</span> positive</span>
        <span><span className="text-[var(--parchment)]">{neutral}</span> neutral</span>
        <span><span className="text-[var(--error)]">{negative}</span> negative</span>
      </div>
    </div>
  );
}

function NoteList({ title, items, dot }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-2 font-[var(--font-mono)] text-[0.6rem] uppercase tracking-[0.14em] text-[var(--mauve)]">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((text) => (
          <li key={text} className="flex gap-2.5 text-[0.82rem] leading-relaxed text-[var(--parchment)]/85">
            <span className={`mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------- Performance ------------------------------- */

export function PerformancePanel({ video, videoId }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    getRequest(`/analytics/director/video/${videoId}?days=${days}`)
      .then((result) => alive && setData(result))
      .catch((e) => alive && setError(e.message || "Unable to load performance."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [videoId, days, reload]);

  const reviewCount = Number(video.reviewCount || 0);
  const avgRating = Number(video.avgRating || 0);
  const likes = Number(video.likes || 0);
  const dislikes = Number(video.dislikes || 0);

  const p = data?.period;
  const platform = data?.platform || {};
  const fb = data?.feedback;

  const finishedNote = p
    ? [
        `${num(p.finishedViewers)} reached the end`,
        platform.completionRate != null ? `platform avg ${platform.completionRate}%` : null,
      ].filter(Boolean).join(" · ")
    : null;

  return (
    <section className="mt-10 border-t border-white/[0.06] pt-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.18em] text-[var(--gold)]">
            Performance
          </p>
          <h2 className="mt-1 font-[var(--font-display)] text-2xl text-[var(--parchment)]">
            How this film is doing
          </h2>
          <p className="mt-1 text-xs text-[var(--mauve)]">
            The key numbers from your analytics dashboard, for this film only.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Performance period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-white/[0.09] bg-[#171216] px-3 py-2 font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.1em] text-[var(--parchment)]"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
          <button
            type="button"
            onClick={() => setReload((n) => n + 1)}
            disabled={loading}
            className="rounded-lg border border-white/[0.09] px-3 py-2 font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.1em] text-[var(--mauve)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold-soft)] disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* All time (from the film itself) */}
      <p className="mb-2 font-[var(--font-mono)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--mauve)]">
        All time
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Total views"
          value={num(video.views)}
          note={`${num(video.uniqueViews)} unique viewers`}
        />
        <StatTile
          label="Likes"
          value={num(likes)}
          note={`${num(dislikes)} dislikes`}
        />
        <StatTile
          label="Rating"
          value={reviewCount ? `${avgRating.toFixed(1)} / 5` : "—"}
          note={`${num(reviewCount)} ${reviewCount === 1 ? "review" : "reviews"}`}
        />
        <StatTile label="Comments" value={num(video.commentCount)} note="Including replies" />
        <StatTile
          label="Watchlist"
          value={data ? num(data.allTime.watchlist) : "…"}
          note="Viewers who saved it"
        />
      </div>

      {error ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--error)]/30 bg-[var(--error)]/10 p-4 text-sm text-[var(--error)]">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReload((n) => n + 1)}
            className="rounded border border-[var(--error)]/40 px-3 py-1 font-[var(--font-mono)] text-[0.62rem] uppercase tracking-wider hover:bg-[var(--error)]/10"
          >
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.02]" />
          ))}
        </div>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {!data.live && (
            <div className="mt-6 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 p-3.5 text-xs text-[var(--gold-soft)]">
              This film isn&rsquo;t public yet, so viewer numbers stay at zero until it is approved.
            </div>
          )}

          <p className="mb-2 mt-7 font-[var(--font-mono)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--mauve)]">
            Last {days} days
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="New viewers" value={num(p.views)} note="Watched 75%+ for the first time" />
            <StatTile label="Plays started" value={num(p.plays)} note="Times the film was started" />
            <StatTile label="Watch time" value={formatMinutes(p.watchMinutes)} note="Added across all viewers" />
            <StatTile
              label="Avg. per play"
              value={formatClock(p.avgWatchSecPerPlay)}
              note={p.avgWatchPercent != null ? `${p.avgWatchPercent}% of the film` : null}
            />
            <StatTile
              label="Finished"
              value={p.completionRatePercent != null ? `${p.completionRatePercent}%` : "—"}
              note={finishedNote}
            />
            <StatTile
              label="Left early"
              value={p.earlyDropPercent != null ? `${p.earlyDropPercent}%` : "—"}
              note="Left in the first 20% (needs 5+ tracked plays)"
            />
            <StatTile label="Watchlist saves" value={num(p.watchlistSaves)} note="New saves in this period" />
            <StatTile
              label="New feedback"
              value={num(p.newReviews + p.newComments)}
              note={`${num(p.newReviews)} reviews · ${num(p.newComments)} comments`}
            />
          </div>

          {platform.avgViews != null && (
            <p className="mt-3 text-[0.68rem] text-[var(--mauve)]">
              Platform average for the same period: {platform.avgViews} new viewers per film
              {platform.completionRate != null ? `, ${platform.completionRate}% finish the film` : ""}.
            </p>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="New viewers over time" subtitle="People who watched most of the film, per day">
              <MiniBars
                rows={data.trend}
                valueKey="views"
                labelKey="date"
                empty="No new viewers in this period yet."
              />
            </Panel>
            <Panel
              title="Where viewers stop watching"
              subtitle="Viewer sessions that reached each part of the film"
            >
              <MiniBars
                rows={data.retention}
                valueKey="sessions"
                labelKey="bucket"
                empty="Playback progress appears once viewers watch. Nothing recorded for this period yet."
              />
            </Panel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="What viewers say" subtitle="Keyword reading of all reviews and comments on this film">
              {fb?.analyzed ? (
                <div className="space-y-4">
                  <SentimentBar sentiment={fb.sentiment} />

                  {fb.themes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {fb.themes.map((t) => (
                        <span
                          key={t.theme}
                          className="rounded-full border border-white/[0.1] px-2.5 py-1 text-[0.68rem] text-[var(--parchment)]/85"
                        >
                          {t.theme} <span className="text-[var(--gold-soft)]">· {t.mentions}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {fb.castMentions.length > 0 && (
                    <p className="text-xs text-[var(--mauve)]">
                      Mentioned by viewers:{" "}
                      <span className="text-[var(--parchment)]/85">
                        {fb.castMentions.map((c) => `${c.name} (${c.mentions})`).join(", ")}
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-[var(--mauve)]">
                  No written feedback yet. Themes appear once viewers leave reviews or comments.
                </p>
              )}
            </Panel>

            <Panel title="At a glance" subtitle="Compared with the platform average">
              {data.highlights.length || data.watchouts.length ? (
                <div className="space-y-5">
                  <NoteList title="What's working" items={data.highlights} dot="bg-[#7ad399]" />
                  <NoteList title="Worth a look" items={data.watchouts} dot="bg-[var(--gold)]" />
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-[var(--mauve)]">
                  Not enough activity yet to point at strengths or problems.
                </p>
              )}
            </Panel>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[0.68rem] text-[var(--mauve)]">
            <span>{data.method}</span>
            <NavLink
              to={ANALYTICS_PATH}
              className="font-[var(--font-mono)] uppercase tracking-[0.1em] text-[var(--gold-soft)] transition hover:text-[var(--parchment)]"
            >
              Open full analytics →
            </NavLink>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------------------------------- Reviews --------------------------------- */

const REVIEW_SORTS = [
  ["recent", "Newest"],
  ["oldest", "Oldest"],
  ["highest", "Highest rated"],
  ["lowest", "Lowest rated"],
];
const REVIEW_PAGE_SIZE = 20;

function DirectorReviewItem({ review }) {
  const edited =
    review.updatedAt &&
    review.createdAt &&
    new Date(review.updatedAt) - new Date(review.createdAt) > 60000;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4">
      <div className="flex gap-3">
        <Avatar url={review.viewerAvatarUrl} name={review.viewerUsername} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-medium text-[var(--parchment)]">
              {review.viewerUsername || "Viewer"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Stars rating={review.rating} />
              <span className="font-[var(--font-mono)] text-[0.68rem] text-[var(--gold-soft)]">
                {Number(review.rating).toFixed(1)}
              </span>
            </span>
            <span className="text-[0.65rem] text-[var(--mauve)]">
              {review.createdAt ? new Date(review.createdAt).toLocaleString() : ""}
              {edited ? " · edited" : ""}
            </span>
          </div>

          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--parchment)]/85">
            {review.text}
          </p>

          <p className="mt-3 font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.08em] text-[var(--mauve)]">
            {num(review.likes)} {review.likes === 1 ? "like" : "likes"}
          </p>
        </div>
      </div>
    </div>
  );
}

function DirectorReviews({ videoId }) {
  const [reviews, setReviews] = useState([]);
  const [meta, setMeta] = useState({ count: 0, total: 0, avgRating: 0, distribution: {} });
  const [sort, setSort] = useState("recent");
  const [star, setStar] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const query = `sort=${sort}&page=${page}&limit=${REVIEW_PAGE_SIZE}${star ? `&rating=${star}` : ""}`;
    getRequest(`/directors/videos/${videoId}/reviews?${query}`)
      .then((result) => {
        if (!alive) return;
        setReviews(result.reviews || []);
        setMeta({
          count: Number(result.count || 0),
          total: Number(result.total || 0),
          avgRating: Number(result.avgRating || 0),
          distribution: result.distribution || {},
        });
      })
      .catch((e) => alive && setError(e.message || "Unable to load audience reviews."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [videoId, sort, star, page, reload]);

  const pages = Math.max(1, Math.ceil(meta.count / REVIEW_PAGE_SIZE));

  return (
    <section className="mt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.18em] text-[var(--gold)]">
            Audience
          </p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="font-[var(--font-display)] text-2xl text-[var(--parchment)]">Reviews</h2>
            <span className="rounded-full border border-white/[0.08] px-2 py-0.5 font-[var(--font-mono)] text-[0.6rem] text-[var(--mauve)]">
              {meta.total}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--mauve)]">
            Viewer reviews and star ratings. This is a read-only director view.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Sort reviews"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-white/[0.09] bg-[#171216] px-3 py-2 font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.1em] text-[var(--parchment)]"
          >
            {REVIEW_SORTS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setReload((n) => n + 1)}
            disabled={loading}
            className="rounded-lg border border-white/[0.09] px-3 py-2 font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.1em] text-[var(--mauve)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold-soft)] disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {meta.total > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5 sm:grid-cols-[auto,1fr]">
          <div className="flex flex-col items-center justify-center sm:px-6">
            <p className="font-[var(--font-display)] text-5xl text-[var(--parchment)]">
              {meta.avgRating.toFixed(1)}
            </p>
            <Stars rating={meta.avgRating} className="mt-2 text-lg" />
            <p className="mt-1.5 text-[0.68rem] text-[var(--mauve)]">
              {meta.total} {meta.total === 1 ? "review" : "reviews"}
            </p>
          </div>

          <div>
            <div className="space-y-0.5">
              {[5, 4, 3, 2, 1].map((s) => {
                const n = Number(meta.distribution?.[String(s)] || 0);
                const pct = meta.total ? (n / meta.total) * 100 : 0;
                const active = star === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setStar(active ? null : s);
                      setPage(1);
                    }}
                    className={`flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left transition ${
                      active ? "bg-[var(--gold)]/10" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="w-6 font-[var(--font-mono)] text-[0.65rem] text-[var(--mauve)]">{s} ★</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <span className="block h-full rounded-full bg-[var(--gold)]" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-6 text-right font-[var(--font-mono)] text-[0.65rem] text-[var(--mauve)]">{n}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[0.62rem] text-[var(--mauve)]">
              Click a row to filter. Half-star ratings are grouped under the whole star below.
            </p>
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-[var(--error)]/30 bg-[var(--error)]/10 p-4 text-sm text-[var(--error)]">
          {error}
        </div>
      ) : loading && !reviews.length ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
          ))}
        </div>
      ) : reviews.length ? (
        <>
          <div className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
            {reviews.map((review) => (
              <DirectorReviewItem key={review.id} review={review} />
            ))}
          </div>

          {pages > 1 && (
            <div className="mt-5 flex items-center justify-between font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.08em] text-[var(--mauve)]">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((n) => Math.max(1, n - 1))}
                className="rounded-lg border border-white/[0.09] px-3 py-1.5 transition hover:border-[var(--gold)]/40 hover:text-[var(--gold-soft)] disabled:opacity-40"
              >
                Previous
              </button>
              <span>Page {page} of {pages}</span>
              <button
                type="button"
                disabled={page >= pages || loading}
                onClick={() => setPage((n) => Math.min(pages, n + 1))}
                className="rounded-lg border border-white/[0.09] px-3 py-1.5 transition hover:border-[var(--gold)]/40 hover:text-[var(--gold-soft)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.015] p-10 text-center text-sm text-[var(--mauve)]">
          {star ? "No reviews match this filter." : "No viewer reviews yet."}
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Comments / Reviews tabs ---------------------------- */

export function AudienceFeedback({ videoId, video, commentsView }) {
  const [tab, setTab] = useState("comments");
  const tabs = [
    ["comments", "Comments", video?.commentCount],
    ["reviews", "Reviews", video?.reviewCount],
  ];

  return (
    <div className="mt-10 border-t border-white/[0.06] pt-8">
      <div
        role="tablist"
        aria-label="Audience feedback"
        className="inline-flex rounded-xl border border-white/[0.09] bg-white/[0.02] p-1"
      >
        {tabs.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-1.5 font-[var(--font-mono)] text-[0.66rem] uppercase tracking-[0.1em] transition ${
              tab === key
                ? "bg-[var(--gold)]/15 text-[var(--gold-soft)]"
                : "text-[var(--mauve)] hover:text-[var(--parchment)]"
            }`}
          >
            {label} <span className="ml-1 opacity-70">{num(count)}</span>
          </button>
        ))}
      </div>

      {tab === "comments" ? commentsView : <DirectorReviews videoId={videoId} />}
    </div>
  );
}