import React, { useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, RefreshCw, Trash2 } from "lucide-react";
import { getRequest, postEmpty } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "flagged", label: "Flagged" },
  { value: "visible", label: "Visible" },
  { value: "removed", label: "Removed" },
  { value: "auto_hidden", label: "Auto-hidden" },
];

function statusMeta(status) {
  if (status === "removed") {
    return {
      label: "Removed",
      className: "border-[#e08a6b]/30 bg-[#e08a6b]/[0.08] text-[#e08a6b]",
    };
  }
  if (status === "auto_hidden") {
    return {
      label: "Auto-hidden",
      className: "border-[#d9a653]/30 bg-[#d9a653]/[0.08] text-[#d9a653]",
    };
  }
  return {
    label: "Visible",
    className: "border-[#7fc59b]/25 bg-[#7fc59b]/[0.07] text-[#9ee2b7]",
  };
}

export default function Comments() {
  const [comments, setComments] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load(selectedFilter = filter) {
    setLoading(true);
    setError("");
    try {
      const data = await getRequest(
        `/admin/comments?status=${encodeURIComponent(selectedFilter)}`
      );
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (err) {
      setComments([]);
      setError(err.message || "Unable to load comments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  async function moderate() {
    if (!action) return;
    setBusy(true);
    setError("");
    try {
      await postEmpty(`/admin/comments/${action.id}/${action.kind}`);
      setAction(null);
      await load(filter);
    } catch (err) {
      setError(err.message || "Comment moderation failed.");
    } finally {
      setBusy(false);
    }
  }

  const visibleCount = useMemo(
    () => comments.filter((comment) => comment.moderationStatus === "visible").length,
    [comments]
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[.2em] text-[#d9a653]">
            Community moderation
          </p>
          <h2 className="mt-2 font-[var(--font-display)] text-3xl">
            Comments
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[#8b7c82]">
            Viewer comments are published immediately. Admin moderation is post-publication: remove comments that violate the community rules and restore them when appropriate.
          </p>
        </div>

        <button
          onClick={() => load(filter)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2.5 text-[10px] uppercase tracking-[.12em] disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/[0.07] p-4 text-sm text-[#e08a6b]">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value)}
            className={`rounded-full border px-3 py-2 font-[var(--font-mono)] text-[9px] uppercase tracking-[.1em] transition ${
              filter === item.value
                ? "border-[#d9a653]/40 bg-[#d9a653]/10 text-[#e5be79]"
                : "border-white/[0.08] text-[#8b7c82] hover:border-white/[0.16] hover:text-[#d9d0d2]"
            }`}
          >
            {item.label}
          </button>
        ))}
        <span className="ml-auto self-center font-[var(--font-mono)] text-[9px] uppercase tracking-[.08em] text-[#71656a]">
          {visibleCount} visible in current view · flagged comments remain public until admin action
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <div className="divide-y divide-white/[0.06]">
          {loading ? (
            [1, 2, 3].map((item) => (
              <div key={item} className="m-4 h-28 animate-pulse rounded-xl bg-white/[0.04]" />
            ))
          ) : comments.length ? (
            comments.map((comment) => {
              const meta = statusMeta(comment.moderationStatus);
              const canRemove = comment.moderationStatus === "visible" || comment.moderationStatus === "auto_hidden";
              const canRestore = comment.moderationStatus === "removed" || comment.moderationStatus === "auto_hidden";

              return (
                <div key={comment.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[8px] uppercase tracking-[.1em] ${meta.className}`}>
                          {meta.label}
                        </span>
                        {comment.moderationFlagged && (
                          <span className="rounded-full border border-[#d9a653]/20 bg-[#d9a653]/[0.05] px-2 py-1 text-[8px] uppercase tracking-[.1em] text-[#d9a653]">
                            Rule flagged
                          </span>
                        )}
                        {(comment.moderationCategories || []).map((category) => (
                          <span key={category} className="rounded-full bg-white/[0.04] px-2 py-1 text-[8px] text-[#95898e]">
                            {category}
                          </span>
                        ))}
                        {comment.moderationFlagged && comment.moderationSeverity && comment.moderationSeverity !== "low" && (
                          <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[8px] uppercase tracking-[.08em] text-[#c9b6bb]">
                            {comment.moderationSeverity} severity
                          </span>
                        )}
                      </div>

                      <p className="mt-3 text-sm leading-relaxed text-[#d9d0d2]">
                        {comment.text}
                      </p>

                      <div className="mt-3 grid gap-1 text-[9px] text-[#71656a] sm:grid-cols-2">
                        <span>Viewer: <b className="font-normal text-[#a99da2]">{comment.viewerUsername || "Viewer"}</b></span>
                        <span>Film: <b className="font-normal text-[#a99da2]">{comment.videoTitle || "Untitled film"}</b></span>
                        <span>Director: <b className="font-normal text-[#a99da2]">{comment.directorUsername || "—"}</b></span>
                        <span>{comment.parentId ? "Reply" : "Top-level comment"} · {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "—"}</span>
                      </div>

                      {comment.moderationFlagged && (
                        <div className="mt-3 rounded-xl border border-[#d9a653]/15 bg-[#d9a653]/4 p-3 text-[9px] text-[#a99da2]">
                          <span className="uppercase tracking-widest text-[#d9a653]">Manual moderation flag</span>
                          <span className="ml-2">Potentially inappropriate wording matched the configured moderation rules.</span>
                          {comment.moderationMatchedTerms?.length > 0 && (
                            <span className="ml-2 text-[#71656a]">Matched: {comment.moderationMatchedTerms.join(", ")}</span>
                          )}
                          {comment.moderationLanguages?.length > 0 && (
                            <span className="ml-2 text-[#71656a]">Language: {comment.moderationLanguages.join(", ")}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {canRestore && (
                        <button
                          disabled={busy}
                          onClick={() => setAction({ ...comment, kind: "restore" })}
                          className="rounded-xl border border-[#7fc59b]/25 px-3 py-2.5 text-[9px] uppercase tracking-[.08em] text-[#9ee2b7] disabled:opacity-50"
                        >
                          <Check size={13} className="mr-1 inline" />
                          Restore
                        </button>
                      )}
                      {canRemove && comment.moderationStatus !== "auto_hidden" && (
                        <button
                          disabled={busy}
                          onClick={() => setAction({ ...comment, kind: "remove" })}
                          className="rounded-xl border border-[#e08a6b]/25 px-3 py-2.5 text-[9px] uppercase tracking-[.08em] text-[#e08a6b] disabled:opacity-50"
                        >
                          <Trash2 size={13} className="mr-1 inline" />
                          Remove
                        </button>
                      )}
                      {comment.moderationStatus === "visible" && (
                        <span className="hidden items-center gap-1 px-2 py-2 text-[9px] uppercase tracking-[.08em] text-[#71656a] sm:inline-flex">
                          <Eye size={13} /> Public
                        </span>
                      )}
                      {comment.moderationStatus === "removed" && (
                        <span className="hidden items-center gap-1 px-2 py-2 text-[9px] uppercase tracking-[.08em] text-[#71656a] sm:inline-flex">
                          <EyeOff size={13} /> Hidden
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-sm text-[#71656a]">
              No comments in this view.
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!action}
        title={action?.kind === "remove" ? "Remove comment?" : "Restore comment?"}
        message={
          action?.kind === "remove"
            ? "This will hide the comment from viewers and directors. It will remain in the admin moderation history."
            : "This will make the comment visible to viewers and directors again."
        }
        confirmLabel={action?.kind === "remove" ? "Remove" : "Restore"}
        danger={action?.kind === "remove"}
        onConfirm={moderate}
        onCancel={() => {
          if (!busy) setAction(null);
        }}
      />
    </div>
  );
}
