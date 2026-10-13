import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import useNotifications, { timeAgo } from "../../hooks/useNotifications.js";

const ALL_PAGE = {
  admin: "/admin/notifications",
  director: "/director/notifications",
  viewer: "/notifications",
};

export default function NotificationBell({ role }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const { items, unread, loading, markRead, markAllRead, refresh } =
    useNotifications();

  useEffect(() => {
    if (!open) return undefined;
    refresh();
    const onDown = (e) =>
      box.current && !box.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refresh]);

  function openItem(n) {
    markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 text-[#d9d0d2] transition-colors hover:border-[#d9a653]/50 hover:text-[#e6c184]"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-[#d9a653] px-1 text-center text-[9px] font-bold leading-4 text-[#100d10]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[200] mt-2 w-[min(92vw,380px)] overflow-hidden rounded-lg border border-white/10 bg-[#171216] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#e6c184]">
              Notifications
            </p>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unread}
              className="flex items-center gap-1 text-[11px] text-[#8b7c82] transition-colors hover:text-[#efe7da] disabled:opacity-40"
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && (
              <p className="px-4 py-6 text-center text-xs text-[#8b7c82]">
                Loading…
              </p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-[#8b7c82]">
                You're all caught up.
              </p>
            )}
            {items.slice(0, 8).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openItem(n)}
                className={`flex w-full gap-3 border-b border-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${n.read ? "" : "bg-[#5c1220]/20"}`}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-[#d9a653]"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-[#efe7da]">
                    {n.title}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-[#a99ca1]">
                    {n.message}
                  </span>
                  <span className="mt-1 block text-[10px] text-[#6f6468]">
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <Link
            to={ALL_PAGE[role] || "/notifications"}
            onClick={() => setOpen(false)}
            className="block border-t border-white/[0.07] px-4 py-2.5 text-center text-[11px] uppercase tracking-[.14em] text-[#d9a653] hover:bg-white/[0.03]"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
