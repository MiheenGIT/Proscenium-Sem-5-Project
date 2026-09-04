import React, {
  useEffect,
  useState,
} from "react";
import {
  Check,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  getRequest,
  postEmpty,
} from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

export default function Comments() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await getRequest(
        "/admin/comments/flagged"
      );

      setComments(
        Array.isArray(data?.comments)
          ? data.comments
          : []
      );
    } catch (err) {
      setComments([]);
      setError(
        err.message ||
          "Unable to load flagged comments."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function moderate() {
    if (!action) return;

    setBusy(true);
    setError("");

    try {
      await postEmpty(
        `/admin/comments/${action.id}/${action.kind}`
      );

      setAction(null);

      await load();
    } catch (err) {
      setError(
        err.message ||
          "Comment moderation failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[.2em] text-[#d9a653]">
            Moderation
          </p>

          <h2 className="mt-2 font-[var(--font-display)] text-3xl">
            Flagged comments
          </h2>

          <p className="mt-2 text-sm text-[#8b7c82]">
            Review comments automatically hidden
            by the existing moderation system.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2.5 text-[10px] uppercase tracking-[.12em] disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={
              loading ? "animate-spin" : ""
            }
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/[0.07] p-4 text-sm text-[#e08a6b]">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <div className="divide-y divide-white/[0.06]">
          {loading ? (
            [1, 2, 3].map((item) => (
              <div
                key={item}
                className="m-4 h-24 animate-pulse rounded-xl bg-white/[0.04]"
              />
            ))
          ) : comments.length ? (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#e08a6b]/20 px-2 py-1 text-[8px] uppercase tracking-[.1em] text-[#e08a6b]">
                        Auto hidden
                      </span>

                      {(
                        comment.aiFlagCategories ||
                        []
                      ).map((category) => (
                        <span
                          key={category}
                          className="rounded-full bg-white/[0.04] px-2 py-1 text-[8px] text-[#95898e]"
                        >
                          {category}
                        </span>
                      ))}
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-[#d9d0d2]">
                      {comment.text}
                    </p>

                    <p className="mt-2 break-all text-[9px] text-[#71656a]">
                      Viewer {comment.viewerId}
                      {" · "}
                      Video {comment.videoId}
                      {" · "}
                      {comment.createdAt
                        ? new Date(
                            comment.createdAt
                          ).toLocaleString()
                        : "—"}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      disabled={busy}
                      onClick={() =>
                        setAction({
                          ...comment,
                          kind: "restore",
                        })
                      }
                      className="rounded-xl border border-white/[0.08] px-3 py-2.5 text-[9px] uppercase tracking-[.08em] text-[#b8acb0] disabled:opacity-50"
                    >
                      <Check
                        size={13}
                        className="mr-1 inline"
                      />
                      Restore
                    </button>

                    <button
                      disabled={busy}
                      onClick={() =>
                        setAction({
                          ...comment,
                          kind: "remove",
                        })
                      }
                      className="rounded-xl border border-[#e08a6b]/25 px-3 py-2.5 text-[9px] uppercase tracking-[.08em] text-[#e08a6b] disabled:opacity-50"
                    >
                      <Trash2
                        size={13}
                        className="mr-1 inline"
                      />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-sm text-[#71656a]">
              No flagged comments.
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!action}
        title={
          action?.kind === "remove"
            ? "Remove comment?"
            : "Restore comment?"
        }
        message={
          action?.kind === "remove"
            ? "The existing Admin API will mark this comment as removed."
            : "The existing Admin API will make this comment visible again."
        }
        confirmLabel={
          action?.kind === "remove"
            ? "Remove"
            : "Restore"
        }
        danger={action?.kind === "remove"}
        onConfirm={moderate}
        onCancel={() => {
          if (!busy) {
            setAction(null);
          }
        }}
      />
    </div>
  );
}