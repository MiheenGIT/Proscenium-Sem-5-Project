import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { getRequest, postEmpty } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import AdminVideoPlayer from "../../components/admin/AdminVideoPlayer.jsx";

function statusMeta(status) {
  if (status === "removed") {
    return {
      label: "Removed",
      className: "border-[#e08a6b]/30 bg-[#e08a6b]/[0.08] text-[#e08a6b]",
    };
  }
  if (status === "auto_hidden" || status === "hidden") {
    return {
      label: "Hidden",
      className: "border-[#d9a653]/30 bg-[#d9a653]/[0.08] text-[#d9a653]",
    };
  }
  return {
    label: "Visible",
    className: "border-[#7fc59b]/25 bg-[#7fc59b]/[0.07] text-[#9ee2b7]",
  };
}

function isFlagged(item) {
  return Boolean(item?.moderationFlagged || item?.aiFlagged);
}

function isHidden(item) {
  return item?.moderationStatus === "removed" || item?.moderationStatus === "hidden" || item?.moderationStatus === "auto_hidden";
}

function isRestored(item) {
  return Array.isArray(item?.moderationHistory) && item.moderationHistory.some(
    (entry) => entry?.action === "restored_by_admin"
  );
}

function itemDate(item) {
  return item?.updatedAt || item?.createdAt || "";
}

function videoFallback(item) {
  return {
    _id: item.videoId,
    title: item.videoTitle || "Untitled film",
    description: item.videoDescription || "",
    thumbnailUrl: item.videoThumbnailUrl || item.video?.thumbnailUrl || null,
    hlsManifestUrl: item.videoStreamUrl || item.video?.hlsManifestUrl || null,
  };
}

function normalizeFeedback(comments, reviews) {
  const commentItems = comments.map((item) => ({
    ...item,
    feedbackType: "comment",
  }));
  const reviewItems = reviews.map((item) => ({
    ...item,
    feedbackType: "review",
  }));

  return [...commentItems, ...reviewItems].sort((a, b) => {
    const flaggedOrder = Number(isFlagged(a)) - Number(isFlagged(b));
    if (flaggedOrder !== 0) return -flaggedOrder;
    return String(itemDate(b)).localeCompare(String(itemDate(a)));
  });
}

export default function Comments() {
  const [items, setItems] = useState([]);
  const [videos, setVideos] = useState({});
  const [filter, setFilter] = useState("flagged");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState(null);
  const [busyId, setBusyId] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [commentsResult, reviewsResult] = await Promise.all([
        getRequest("/admin/comments?status=all"),
        getRequest("/admin/reviews?status=all"),
      ]);

      const comments = Array.isArray(commentsResult?.comments) ? commentsResult.comments : [];
      const reviews = Array.isArray(reviewsResult?.reviews) ? reviewsResult.reviews : [];
      const merged = normalizeFeedback(comments, reviews);
      setItems(merged);

      const videoIds = [...new Set(merged.map((item) => item.videoId).filter(Boolean).map(String))];
      const detailEntries = await Promise.all(
        videoIds.map(async (videoId) => {
          try {
            return [videoId, await getRequest(`/admin/videos/${videoId}`)];
          } catch {
            const fallback = merged.find((item) => String(item.videoId) === videoId);
            return [videoId, fallback ? videoFallback(fallback) : { _id: videoId, title: "Untitled film" }];
          }
        })
      );
      setVideos(Object.fromEntries(detailEntries));
    } catch (err) {
      setItems([]);
      setVideos({});
      setError(err.message || "Unable to load comments and reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const flagged = items.filter(isFlagged).length;
    const removed = items.filter((item) => item.moderationStatus === "removed").length;
    const hidden = items.filter((item) => item.moderationStatus === "hidden" || item.moderationStatus === "auto_hidden").length;
    const restored = items.filter(isRestored).length;
    return { all: items.length, flagged, removed, hidden, restored, removedHidden: removed + hidden };
  }, [items]);

  const visibleItems = useMemo(() => {
    const value = query.trim().toLowerCase();

    return items.filter((item) => {
      if (filter === "flagged" && !isFlagged(item)) return false;
      if (filter === "removed" && item.moderationStatus !== "removed") return false;
      if (filter === "hidden" && !(item.moderationStatus === "hidden" || item.moderationStatus === "auto_hidden")) return false;
      if (filter === "restored" && !isRestored(item)) return false;

      if (!value) return true;
      const haystack = [
        item.text,
        item.viewerUsername,
        item.videoTitle,
        item.directorUsername,
        item.feedbackType,
        ...(item.moderationCategories || []),
        ...(item.moderationMatchedTerms || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(value);
    });
  }, [items, filter, query]);

  const groups = useMemo(() => {
    const map = new Map();
    visibleItems.forEach((item) => {
      const id = String(item.videoId || `unknown-${item.id}`);
      if (!map.has(id)) {
        map.set(id, {
          id,
          video: videos[id] || videoFallback(item),
          items: [],
        });
      }
      map.get(id).items.push(item);
    });

    for (const group of map.values()) {
      group.items.sort((a, b) => {
        const flaggedOrder = Number(isFlagged(a)) - Number(isFlagged(b));
        if (flaggedOrder !== 0) return -flaggedOrder;
        return String(itemDate(b)).localeCompare(String(itemDate(a)));
      });
    }

    return [...map.values()].sort((a, b) => {
      const aFlagged = a.items.some(isFlagged);
      const bFlagged = b.items.some(isFlagged);
      if (aFlagged !== bFlagged) return Number(bFlagged) - Number(aFlagged);
      return String(itemDate(b.items[0])).localeCompare(String(itemDate(a.items[0])));
    });
  }, [visibleItems, videos]);

  async function moderate(item, kind) {
    if (!item?.id) return;
    setBusyId(`${item.feedbackType}-${item.id}`);
    setError("");

    try {
      const resource = item.feedbackType === "review" ? "reviews" : "comments";
      await postEmpty(`/admin/${resource}/${item.id}/${kind}`);
      setAction(null);
      await load();
    } catch (err) {
      setError(err.message || `Unable to ${kind} this ${item.feedbackType}.`);
    } finally {
      setBusyId("");
    }
  }

  const filterTabs = [
    { id: "flagged", label: "Flagged", count: counts.flagged, icon: ShieldAlert },
    { id: "restored", label: "Restored", count: counts.restored, icon: Check },
    { id: "removed", label: "Removed", count: counts.removed, icon: Trash2 },
    { id: "hidden", label: "Hidden", count: counts.hidden, icon: EyeOff },
    { id: "all", label: "All", count: counts.all, icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-[#d9a653]" />
            <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-[.2em] text-[#d9a653]">Community moderation</p>
          </div>
          <h2 className="mt-2 font-[var(--font-display)] text-3xl text-[#efe7da]">Comments & Reviews</h2>
          <p className="mt-2 max-w-3xl text-sm text-[#8b7c82]">
            Review flagged feedback, inspect its film context, and restore or remove viewer comments and reviews without leaving the Admin workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.025] px-4 py-2.5 font-[var(--font-mono)] text-[10px] uppercase tracking-[.12em] text-[#d9d0d2] hover:bg-white/[0.06] hover:text-white disabled:opacity-50 transition"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh moderation
        </button>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/[0.07] p-4 text-sm text-[#e08a6b]">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Flagged", counts.flagged, "text-[#e08a6b]"],
          ["Restored", counts.restored, "text-[#9ee2b7]"],
          ["Removed", counts.removed, "text-[#e08a6b]"],
          ["Hidden", counts.hidden, "text-[#d9a653]"],
          ["Total feedback", counts.all, "text-[#efe7da]"],
        ].map(([label, count, textClass]) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
            <p className="font-[var(--font-mono)] text-[8.5px] uppercase tracking-[.12em] text-[#71656a]">{label}</p>
            <p className={`mt-1.5 font-[var(--font-display)] text-2xl ${textClass}`}>{count}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 focus-within:border-[#d9a653]/40">
          <Search size={15} className="shrink-0 text-[#71656a]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search feedback, viewer, film, category…"
            className="w-full bg-transparent py-2.5 text-xs text-[#efe7da] outline-none placeholder:text-[#71656a]"
          />
          {query && <button type="button" onClick={() => setQuery("")} className="text-[#71656a] hover:text-[#d9d0d2]" aria-label="Clear search"><X size={14} /></button>}
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/[0.08] bg-black/30 p-1">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-[var(--font-mono)] text-[9px] uppercase tracking-wider transition ${
                  active
                    ? "border border-white/15 bg-white/[0.08] text-[#efe7da]"
                    : "text-[#8b7c82] hover:bg-white/[0.04] hover:text-[#d9d0d2]"
                }`}
              >
                <Icon size={12} />
                {tab.label}
                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[8px]">{tab.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-5">
          {[1, 2].map((item) => <div key={item} className="h-[420px] animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.025]" />)}
        </div>
      ) : groups.length ? (
        <div className="space-y-5">
          {groups.map((group) => {
            const video = group.video || {};
            const groupFlagged = group.items.filter(isFlagged).length;
            return (
              <section key={group.id} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
                <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                  <div className="min-w-0 bg-black/90 p-3 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-[var(--font-mono)] text-[8px] uppercase tracking-[.16em] text-[#d9a653]">Film context</p>
                        <h3 className="mt-1 truncate font-[var(--font-display)] text-xl text-[#efe7da]">{video.title || "Untitled film"}</h3>
                      </div>
                      <span className="shrink-0 rounded-full border border-[#e08a6b]/25 bg-[#e08a6b]/[0.06] px-2.5 py-1 font-[var(--font-mono)] text-[8px] uppercase tracking-wider text-[#e08a6b]">
                        {groupFlagged} flagged
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-white/10 shadow-2xl">
                      {video.hlsManifestUrl ? (
                        <AdminVideoPlayer src={video.hlsManifestUrl} poster={video.thumbnailUrl} title={video.title} />
                      ) : video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
                      ) : (
                        <div className="grid aspect-video place-items-center bg-black text-xs text-[#71656a]">Video preview unavailable.</div>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] text-[#71656a]">
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">Status: <span className="text-[#b8acb0]">{video.moderationStatus || video.status || "—"}</span></div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">Director: <span className="text-[#b8acb0]">{video.director?.username || video.directorUsername || group.items[0]?.directorUsername || "—"}</span></div>
                    </div>
                  </div>

                  <div className="min-w-0 border-t border-white/[0.08] bg-[#171216] lg:border-l lg:border-t-0">
                    <div className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#171216]/95 px-4 py-3 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-[var(--font-mono)] text-[8px] uppercase tracking-[.16em] text-[#d9a653]">Moderation queue</p>
                          <p className="mt-1 text-[10px] text-[#71656a]">{group.items.length} feedback item{group.items.length === 1 ? "" : "s"} for this film</p>
                        </div>
                        <MessageSquare size={14} className="text-[#71656a]" />
                      </div>
                    </div>

                    <div className="divide-y divide-white/[0.06]">
                      {group.items.map((item) => {
                        const flagged = isFlagged(item);
                        const status = statusMeta(item.moderationStatus);
                        const itemKey = `${item.feedbackType}-${item.id}`;
                        const itemBusy = busyId === itemKey;
                        const canRestore = isHidden(item);
                        const canRemove = item.moderationStatus === "visible" || !item.moderationStatus;

                        return (
                          <article key={itemKey} className={`p-4 sm:p-5 ${flagged ? "bg-[#e08a6b]/[0.035]" : ""}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-[var(--font-mono)] text-[8px] uppercase tracking-[.12em] text-[#d9a653]">{item.feedbackType}</span>
                                  {flagged && <span className="rounded border border-[#e08a6b]/30 bg-[#e08a6b]/10 px-1.5 py-0.5 text-[7.5px] uppercase tracking-wider text-[#e08a6b]">Flagged</span>}
                                  <span className={`rounded border px-1.5 py-0.5 text-[7.5px] uppercase tracking-wider ${status.className}`}>{status.label}</span>
                                  {item.feedbackType === "review" && (
                                    <span className="inline-flex items-center gap-0.5 text-[#d9a653]">
                                      <Star size={9} fill="currentColor" />
                                      <span className="text-[8px]">{Number(item.rating || 0).toFixed(1)}</span>
                                    </span>
                                  )}
                                </div>

                                <p className="mt-2 text-[10px] text-[#71656a]">
                                  Viewer: <span className="text-[#b8acb0]">{item.viewerUsername || "Viewer"}</span>
                                  {item.parentId ? " · Reply" : " · Top-level"}
                                  {itemDate(item) ? ` · ${new Date(itemDate(item)).toLocaleString()}` : ""}
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#d9d0d2]">{item.text || "No text provided."}</p>

                                {(item.moderationCategories?.length || item.moderationMatchedTerms?.length || item.moderationLanguages?.length || item.moderationSeverity || item.moderationCheckFailed) ? (
                                  <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                                    <p className="font-[var(--font-mono)] text-[7.5px] uppercase tracking-[.14em] text-[#71656a]">Moderation details</p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {(item.moderationCategories || []).map((category) => <span key={category} className="rounded border border-[#e08a6b]/20 px-1.5 py-0.5 text-[7.5px] text-[#e08a6b]">{category}</span>)}
                                      {(item.moderationLanguages || []).map((language) => <span key={language} className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[7.5px] text-[#95898e]">{language}</span>)}
                                      {item.moderationSeverity && <span className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[7.5px] uppercase text-[#95898e]">{item.moderationSeverity} severity</span>}
                                      {item.moderationCheckFailed && <span className="rounded border border-[#e08a6b]/20 px-1.5 py-0.5 text-[7.5px] text-[#e08a6b]">Moderation check failed</span>}
                                    </div>
                                    {item.moderationMatchedTerms?.length ? <p className="mt-2 text-[8px] text-[#71656a]">Matched terms: <span className="text-[#a99da2]">{item.moderationMatchedTerms.join(", ")}</span></p> : null}
                                  </div>
                                ) : null}

                                {item.moderationHistory?.length ? (
                                  <details className="mt-3">
                                    <summary className="cursor-pointer font-[var(--font-mono)] text-[7.5px] uppercase tracking-[.12em] text-[#71656a]">Moderation history ({item.moderationHistory.length})</summary>
                                    <div className="mt-2 space-y-1">
                                      {item.moderationHistory.slice().reverse().map((entry, index) => (
                                        <p key={`${entry.moderatedAt || "entry"}-${index}`} className="text-[8px] text-[#71656a]">
                                          {entry.action || "moderation"} · {entry.moderatedAt ? new Date(entry.moderatedAt).toLocaleString() : "undated"}
                                        </p>
                                      ))}
                                    </div>
                                  </details>
                                ) : null}
                              </div>

                              <div className="flex shrink-0 flex-col gap-2">
                                {canRestore && (
                                  <button
                                    type="button"
                                    disabled={!!busyId}
                                    onClick={() => setAction({ item, kind: "restore" })}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#7fc59b]/25 px-2.5 py-2 text-[7.5px] uppercase tracking-wider text-[#9ee2b7] hover:bg-[#7fc59b]/10 disabled:opacity-40"
                                  >
                                    <Check size={11} /> Restore
                                  </button>
                                )}
                                {canRemove && (
                                  <button
                                    type="button"
                                    disabled={!!busyId}
                                    onClick={() => setAction({ item, kind: "remove" })}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#e08a6b]/25 px-2.5 py-2 text-[7.5px] uppercase tracking-wider text-[#e08a6b] hover:bg-[#e08a6b]/10 disabled:opacity-40"
                                  >
                                    <Trash2 size={11} /> Remove
                                  </button>
                                )}
                                {!canRestore && !canRemove && (
                                  <span className="inline-flex items-center gap-1 px-1 text-[7.5px] uppercase tracking-wider text-[#71656a]">
                                    <Eye size={11} /> Public
                                  </span>
                                )}
                                {itemBusy && <RefreshCw size={12} className="mx-auto animate-spin text-[#d9a653]" />}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-14 text-center">
          {filter === "flagged" ? <ShieldAlert size={28} className="mx-auto text-[#71656a]" /> : <MessageSquare size={28} className="mx-auto text-[#71656a]" />}
          <p className="mt-3 text-sm text-[#8b7c82]">No {filter === "all" ? "feedback" : `${filter} feedback`} found.</p>
          <p className="mt-1 text-xs text-[#71656a]">{query ? "Try adjusting your search." : "The moderation queue is clear for this view."}</p>
        </div>
      )}

      <ConfirmDialog
        open={!!action}
        title={action?.kind === "remove" ? `Remove ${action?.item?.feedbackType || "feedback"}?` : `Restore ${action?.item?.feedbackType || "feedback"}?`}
        message={action?.kind === "remove"
          ? "This hides the feedback from viewers. Its moderation metadata and history remain available to Admins."
          : "This makes the feedback visible again. If its moderation flag is still active, it will remain in the flagged queue until the current flag is cleared."
        }
        confirmLabel={action?.kind === "remove" ? "Remove" : "Restore"}
        danger={action?.kind === "remove"}
        onConfirm={() => moderate(action.item, action.kind)}
        onCancel={() => { if (!busyId) setAction(null); }}
      />
    </div>
  );
}
