import React from "react";
import { useNavigate } from "react-router-dom";
import { CheckCheck } from "lucide-react";
import useNotifications, { timeAgo } from "../../hooks/useNotifications.js";
import DirectorNav from "../../components/DirectorNav.jsx";

export default function NotificationsPage({ role }) {
  const navigate = useNavigate();
  const {
    items,
    unread,
    hasMore,
    loading,
    error,
    loadMore,
    markRead,
    markAllRead,
  } = useNotifications({ poll: false });

  function openItem(n) {
    markRead(n.id);
    if (n.link) navigate(n.link);
  }

  const content = (
    <div className="mx-auto w-full max-w-3xl px-1 py-6 text-[#efe7da]">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[.22em] text-[#d9a653]">
            Updates
          </p>
          <h1 className="mt-1 font-(--font-display) text-2xl">Notifications</h1>
          <p className="mt-1 text-xs text-[#8b7c82]">
            {unread ? `${unread} unread` : "All caught up"}
          </p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          disabled={!unread}
          className="flex items-center gap-1.5 rounded border border-white/10 px-3 py-1.5 text-xs text-[#d9d0d2] transition-colors hover:border-[#d9a653]/50 disabled:opacity-40"
        >
          <CheckCheck size={14} /> Mark all read
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {loading && (
        <p className="mt-10 text-center text-sm text-[#8b7c82]">Loading…</p>
      )}
      {!loading && !items.length && (
        <p className="mt-10 text-center text-sm text-[#8b7c82]">
          No notifications yet.
        </p>
      )}

      <ul className="mt-6 divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.07] bg-[#171216]">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => openItem(n)}
              className={`flex w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.04] ${n.read ? "" : "bg-[#5c1220]/20"}`}
            >
              <span
                className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-[#d9a653]"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">
                    {n.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-[#6f6468]">
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-[#a99ca1]">
                  {n.message}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          className="mx-auto mt-5 block rounded border border-white/10 px-5 py-2 text-xs text-[#d9d0d2] hover:border-[#d9a653]/50"
        >
          Load more
        </button>
      )}
    </div>
  );

  if (role === "director") {
    return (
      <div className="min-h-screen bg-(--stage)">
        <DirectorNav />
        <div className="px-6">{content}</div>
      </div>
    );
  }
  return content;
}
