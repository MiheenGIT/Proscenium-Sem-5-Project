import React from "react";
import {
  Bookmark,
  Compass,
  History,
  Home,
  LogOut,
  Search,
  Sparkles,
  User,
  X,
  PlayCircle,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const items = [
  ["Home", "/viewer", Home],
  ["Search", null, Search],
  ["Discover", "/explore", Compass],
  ["Continue Watching", "/continue-watching", PlayCircle],
  ["Watchlist", "/watchlist", Bookmark],
  ["History", "/history", History],
];

export default function Sidebar({ mobileOpen, setMobileOpen, onSearch }) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const name = auth?.username || "Viewer";

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  const renderItem = ([label, to, Icon]) => {
    const common =
      "group relative flex h-11 w-full items-center rounded-xl text-[#a69a9f] transition-all duration-200 hover:bg-white/[0.055] hover:text-[#efe7da]";

    if (!to) {
      return (
        <button
          key={label}
          type="button"
          onClick={onSearch}
          className={common}
          aria-label="Search"
        >
          <span className="grid w-[64px] shrink-0 place-items-center">
            <Icon size={21} strokeWidth={1.7} />
          </span>
          <span className="sidebar-label whitespace-nowrap text-[12px] font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {label}
          </span>
        </button>
      );
    }

    return (
      <NavLink
        key={label}
        to={to}
        end={to === "/viewer"}
        onClick={() => setMobileOpen(false)}
        className={({ isActive }) =>
          `${common} ${
            isActive
              ? "bg-[#651322] text-[#e6c184] shadow-[inset_0_0_0_1px_rgba(217,166,83,.18)]"
              : ""
          }`
        }
      >
        <span className="grid w-[64px] shrink-0 place-items-center">
          <Icon size={21} strokeWidth={1.7} />
        </span>
        <span className="sidebar-label whitespace-nowrap text-[12px] font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {label}
        </span>
      </NavLink>
    );
  };

  const desktopRail = (
    <aside className="viewer-sidebar group fixed inset-y-0 left-0 z-[100] hidden w-[76px] flex-col overflow-hidden border-r border-white/[0.07] bg-[#0c080a]/96 py-5 shadow-[12px_0_40px_rgba(0,0,0,.12)] backdrop-blur-2xl transition-[width] duration-200 hover:w-[218px] lg:flex">
      <button
        type="button"
        onClick={() => navigate("/viewer")}
        className="mb-8 flex h-14 w-full items-center text-left"
        aria-label="Proscenium home"
      >
        <span className="grid w-[76px] shrink-0 place-items-center">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#641322] font-[var(--font-display)] text-xl font-bold text-[#d9a653] shadow-[0_8px_24px_rgba(92,18,32,.3)]">
            P
          </span>
        </span>
        <span className="sidebar-label whitespace-nowrap font-[var(--font-display)] text-[12px] font-semibold tracking-[0.16em] text-[#efe7da] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          PROSCENIUM
        </span>
      </button>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {items.map(renderItem)}
      </nav>

      <div className="border-t border-white/[0.07] px-3 pt-3">
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="group relative flex h-11 w-full items-center rounded-xl text-[#a69a9f] transition hover:bg-white/[0.055] hover:text-[#efe7da]"
        >
          <span className="grid w-[64px] shrink-0 place-items-center">
            <Avatar src={auth?.avatarUrl} name={name} />
          </span>
          <span className="sidebar-label whitespace-nowrap text-[12px] font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {name}
          </span>
        </button>

        <button
          type="button"
          onClick={signOut}
          className="group relative mt-1 flex h-10 w-full items-center rounded-xl text-[#806f75] transition hover:bg-white/[0.045] hover:text-[#e08a6b]"
        >
          <span className="grid w-[64px] shrink-0 place-items-center">
            <LogOut size={18} />
          </span>
          <span className="sidebar-label whitespace-nowrap text-[12px] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {desktopRail}

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            onClick={(event) => event.stopPropagation()}
            className="h-full w-[270px] border-r border-white/10 bg-[#10080b] p-4"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  navigate("/viewer");
                  setMobileOpen(false);
                }}
                className="flex items-center gap-3"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#641322] font-[var(--font-display)] text-xl font-bold text-[#d9a653]">
                  P
                </span>
                <span className="font-[var(--font-display)] text-sm tracking-[0.14em] text-[#efe7da]">
                  PROSCENIUM
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.05] text-[#efe7da]"
                aria-label="Close navigation"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-8 space-y-1">
              {items.map(([label, to, Icon]) =>
                to ? (
                  <NavLink
                    key={label}
                    to={to}
                    end={to === "/viewer"}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-4 py-3 text-[12px] ${
                        isActive
                          ? "bg-[#641322] text-[#e6c184]"
                          : "text-[#9b8d92] hover:bg-white/[0.04] hover:text-[#efe7da]"
                      }`
                    }
                  >
                    <Icon size={18} />
                    {label}
                  </NavLink>
                ) : (
                  <button
                    key={label}
                    type="button"
                    onClick={onSearch}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[12px] text-[#9b8d92] hover:bg-white/[0.04] hover:text-[#efe7da]"
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                )
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export function Avatar({ src, name }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="h-8 w-8 rounded-full border border-white/10 object-cover"
      />
    );
  }

  return (
    <span className="grid h-8 w-8 place-items-center rounded-full border border-[#d9a653]/25 bg-[#5c1220] text-[10px] font-semibold text-[#d9a653]">
      {(name || "V").trim().charAt(0).toUpperCase()}
    </span>
  );
}
