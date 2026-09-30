import React, { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Info,
  MoreVertical,
  Play,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { deleteRequest, getRequest } from "../../api/client.js";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import {
  EmptyState,
  ErrorState,
  PageLoading,
} from "../../components/common/States.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

const pct = (video) =>
  Math.min(100, Math.max(0, Math.round(Number(video.progress || 0) * 100)));

const dateKey = (value) => {
  if (!value) return "earlier";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "earlier";

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startToday - startDate) / 86400000);

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays >= 2 && diffDays <= 7) return "week";
  return "earlier";
};

const groupOrder = ["today", "yesterday", "week", "earlier"];

const groupLabel = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Earlier This Week",
  earlier: "Earlier",
};

const formatWatchedAt = (value) => {
  if (!value) return "Watched recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Watched recently";

  return `Watched ${date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })} • ${date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
};

export default function ViewerHistoryPro() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await getRequest("/viewer/history?limit=100");
      setRows(response.videos || []);
    } catch (err) {
      setError(err.message || "Unable to load watch history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const closeMenu = (event) => {
      if (!event.target.closest("[data-history-menu]")) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  async function clear() {
    setConfirmClear(false);
    setError("");

    try {
      await deleteRequest("/viewer/history");
      setRows([]);
      setSearch("");
    } catch (err) {
      setError(err.message || "Unable to clear watch history.");
    }
  }

  async function removeItem() {
    if (!removeTarget) return;

    setRemoving(true);
    setError("");

    try {
      await deleteRequest(`/viewer/history/${removeTarget.id}`);
      setRows((current) =>
        current.filter((video) => String(video.id) !== String(removeTarget.id))
      );
      setRemoveTarget(null);
      setOpenMenu(null);
    } catch (err) {
      setError(err.message || "Unable to remove this video from history.");
    } finally {
      setRemoving(false);
    }
  }

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((video) => {
      const haystack = [
        video.title,
        video.genre,
        video.genres,
        video.category,
        video.releaseYear,
      ]
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [rows, search]);

  const groups = useMemo(() => {
    const grouped = {
      today: [],
      yesterday: [],
      week: [],
      earlier: [],
    };

    filteredRows.forEach((video) => {
      grouped[dateKey(video.lastWatchedAt)].push(video);
    });

    return grouped;
  }, [filteredRows]);

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        {/* Header */}
        <header className="flex flex-col gap-5 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#d9a653]">
              <Clock3 size={12} />
              Viewing activity
            </div>

            <h1 className="mt-2 font-[var(--font-display)] text-3xl text-[#efe7da] sm:text-4xl">
              History
            </h1>

            <p className="mt-1.5 text-xs leading-5 text-[#8f8388] sm:text-sm">
              Revisit the films you have watched and pick up where you left off.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {rows.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a79b9f] transition hover:border-red-300/20 hover:text-[#e08a6b]"
              >
                <Trash2 size={13} />
                Clear history
              </button>
            )}
          </div>
        </header>

        {rows.length > 0 && (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 focus-within:border-white/[0.16]">
            <Search size={16} className="shrink-0 text-[#756a6f]" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search history..."
              aria-label="Search watch history"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#efe7da] outline-none placeholder:text-[#6f656a]"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear history search"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#8f8388] transition hover:bg-white/[0.06] hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mt-5">
            <ErrorState message={error} onRetry={load} />
          </div>
        )}

        {!rows.length && !error ? (
          <div className="mt-8">
            <EmptyState
              title="Your history is empty"
              message="Films you watch will appear here with their saved progress."
            />
          </div>
        ) : filteredRows.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-12 text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.025] text-[#756a6f]">
              <Search size={17} />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-[#efe7da]">
              No history found
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-[#756a6f]">
              Try another title, genre, or release year.
            </p>
          </section>
        ) : (
          <section className="mt-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#756a6f]">
                  Your viewing activity
                </p>
                <p className="mt-1 text-xs text-[#8f8388]">
                  {filteredRows.length} {filteredRows.length === 1 ? "video" : "videos"}
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {groupOrder.map((group) => {
                const items = groups[group];
                if (!items.length) return null;

                return (
                  <section key={group}>
                    <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a79b9f]">
                      {groupLabel[group]}
                    </h2>

                    <div className="divide-y divide-white/[0.06] overflow-visible border-y border-white/[0.06]">
                      {items.map((video) => {
                        const progress = pct(video);
                        const watchedLabel = video.completed
                          ? "Completed"
                          : `${progress}% watched`;

                        return (
                          <article
                            key={video.id}
                            className="group relative flex gap-3 py-3 sm:gap-4 sm:py-3.5"
                          >
                            <button
                              type="button"
                              onClick={() => navigate(`/viewer/videos/${video.id}`)}
                              className="relative block h-[78px] w-[138px] shrink-0 overflow-hidden rounded-lg bg-[#151316] text-left sm:h-[88px] sm:w-[156px]"
                              aria-label={`Watch ${video.title}`}
                            >
                              <img
                                src={video.thumbnailUrl}
                                alt=""
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                              />

                              <span className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/75 to-transparent" />

                              <span className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                                <span
                                  className="block h-full bg-[#d9a653]"
                                  style={{ width: `${progress}%` }}
                                />
                              </span>

                              {!video.completed && progress > 0 && (
                                <span className="absolute bottom-2 left-2 rounded bg-black/65 px-1.5 py-0.5 text-[8px] font-semibold text-white/90">
                                  {progress}%
                                </span>
                              )}
                            </button>

                            <div className="min-w-0 flex-1 pr-8 sm:pr-10">
                              <button
                                type="button"
                                onClick={() => navigate(`/viewer/videos/${video.id}`)}
                                className="block max-w-full text-left"
                              >
                                <h3 className="line-clamp-2 font-[var(--font-display)] text-sm leading-5 text-[#efe7da] transition group-hover:text-white sm:text-[15px]">
                                  {video.title}
                                </h3>
                              </button>

                              <p className="mt-1 text-[10px] text-[#8f8388]">
                                {video.genres?.length
                                  ? video.genres.join(" • ")
                                  : video.genre || video.category || "Film"}
                                {video.releaseYear ? ` • ${video.releaseYear}` : ""}
                              </p>

                              <p className="mt-1 text-[9px] text-[#756a6f]">
                                {formatWatchedAt(video.lastWatchedAt)} • {watchedLabel}
                              </p>
                            </div>

                            <div
                              data-history-menu
                              className="absolute right-0 top-3"
                            >
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenMenu((current) =>
                                    current === video.id ? null : video.id
                                  );
                                }}
                                aria-label={`Actions for ${video.title}`}
                                className="grid h-8 w-8 place-items-center rounded-full text-[#756a6f] transition hover:bg-white/[0.06] hover:text-white"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {openMenu === video.id && (
                                <div className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#19171a] p-1 shadow-2xl shadow-black/40">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenu(null);
                                      navigate(`/viewer/videos/${video.id}`);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-[#d9d0d1] transition hover:bg-white/[0.06] hover:text-white"
                                  >
                                    <Play size={14} />
                                    Watch Video
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenu(null);
                                      navigate(`/viewer/videos/${video.id}`);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-[#d9d0d1] transition hover:bg-white/[0.06] hover:text-white"
                                  >
                                    <Info size={14} />
                                    View Details
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenu(null);
                                      setRemoveTarget(video);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-[#e08a6b] transition hover:bg-red-300/[0.06]"
                                  >
                                    <Trash2 size={14} />
                                    Remove from History
                                  </button>
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <ConfirmDialog
        open={confirmClear}
        title="Clear Watch History?"
        message="Are you sure you want to clear your entire watch history? This action cannot be undone."
        confirmLabel="Clear History"
        danger={true}
        onConfirm={clear}
        onCancel={() => setConfirmClear(false)}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove from History?"
        message={
          removeTarget
            ? `Remove “${removeTarget.title}” from your watch history?`
            : "Remove this video from your watch history?"
        }
        confirmLabel={removing ? "Removing..." : "Remove from History"}
        danger={true}
        onConfirm={removeItem}
        onCancel={() => !removing && setRemoveTarget(null)}
      />
    </DashboardLayout>
  );
}
