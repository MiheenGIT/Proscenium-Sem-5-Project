import React from "react";
import {
  Bell,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const labels = {
  "/admin": "Dashboard",
  "/admin/content": "Content",
  "/admin/review": "Review queue",
  "/admin/comments": "Comments",
};

export default function Topbar() {
  const { auth } = useAuth();
  const { pathname } = useLocation();

  const title =
    labels[pathname] || "Admin";

  const username =
    auth?.username || "Admin";

  return (
    <header className="sticky top-0 z-40 flex h-19 items-center gap-3 border-b border-white/[0.07] bg-[#100d10]/85 px-4 pl-16 backdrop-blur-xl sm:px-6 sm:pl-16 lg:px-8 lg:pl-8">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[9px] uppercase tracking-[.18em] text-[#71656a]">
          <span>Admin</span>

          <ChevronRight size={11} />

          <span className="text-[#d9a653]">
            {title}
          </span>
        </div>

        <h1 className="mt-1 truncate font-(--font-display) text-lg text-[#efe7da]">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="grid h-9 w-9 place-items-center rounded-xl bg-white/4 text-[#b8acb0]"
          aria-label="Notifications"
        >
          <Bell size={16} />
        </button>

        <div className="hidden text-right sm:block">
          <p className="text-[11px] font-medium text-[#d9d0d2]">
            {username}
          </p>

          <p className="text-[8px] uppercase tracking-[.14em] text-[#6f6468]">
            Administrator
          </p>
        </div>

        <div className="grid h-9 w-9 place-items-center rounded-full border border-[#d9a653]/30 bg-[#5c1220] text-xs font-semibold text-[#e6c184]">
          {username
            .slice(0, 1)
            .toUpperCase()}
        </div>
      </div>
    </header>
  );
}