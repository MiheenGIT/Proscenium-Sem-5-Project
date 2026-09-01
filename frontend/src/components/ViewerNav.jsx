import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Bookmark,
  Film,
  History,
  LogOut,
  Menu,
  Search,
  User,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext.jsx";

export default function ViewerNav() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const items = [
    ["Home", "/viewer", Film],
    ["History", "/viewer/history", History],
    ["Watchlist", "/viewer/watchlist", Bookmark],
    ["Profile", "/viewer/profile", User],
  ];

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  function closeMobileMenu() {
    setOpen(false);
  }

  return (
    <header
      className="
        sticky top-0 z-50
        border-b border-white/10
        bg-[rgba(16,13,16,0.96)]
        backdrop-blur
      "
    >
      <div
        className="
          mx-auto
          flex max-w-7xl
          items-center justify-between
          gap-4
          px-5 py-4
          lg:px-8
        "
      >
        {/* -------------------------------------------------
            BRAND
        ------------------------------------------------- */}

        <button
          type="button"
          onClick={() => navigate("/viewer")}
          className="flex items-center gap-3 text-left"
          aria-label="Go to Viewer Home"
        >
          <span
            className="
              grid h-9 w-9
              shrink-0
              place-items-center
              rounded-[3px]
              bg-(--velvet)
              text-(--gold)
            "
          >
            <Film size={18} />
          </span>

          <span>
            <span
              className="
                block
                font-(--font-display)
                text-xl
                text-(--parchment)
              "
            >
              Proscenium
            </span>

            <span
              className="
                block
                font-(--font-mono)
                text-[0.58rem]
                uppercase
                tracking-[0.14em]
                text-(--mauve)
              "
            >
              The Viewer House
            </span>
          </span>
        </button>

        {/* -------------------------------------------------
            DESKTOP NAVIGATION
        ------------------------------------------------- */}

        <nav className="hidden items-center gap-1 md:flex">
          {items.map(([label, to, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/viewer"}
              className={({ isActive }) =>
                [
                  "flex items-center gap-2",
                  "rounded-[3px]",
                  "px-3 py-2",
                  "font-(--font-mono)",
                  "text-[0.68rem]",
                  "uppercase",
                  "tracking-[0.08em]",
                  "transition-colors",
                  "duration-200",

                  isActive
                    ? "bg-(--velvet) text-(--gold-soft)"
                    : "text-(--mauve) hover:text-(--parchment)",
                ].join(" ")
              }
            >
              <Icon size={15} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* -------------------------------------------------
            DESKTOP ACTIONS
        ------------------------------------------------- */}

        <div className="hidden items-center gap-3 md:flex">
          {/* Search */}

          <button
            type="button"
            onClick={() => navigate("/viewer?focus=search")}
            className="
              rounded-[3px]
              border border-white/10
              p-2
              text-(--mauve)
              transition-colors
              duration-200
              hover:border-(--gold)
              hover:text-(--gold-soft)
            "
            aria-label="Search"
          >
            <Search size={17} />
          </button>

          {/* Username */}

          <button
            type="button"
            onClick={() => navigate("/viewer/profile")}
            className="
              max-w-32
              truncate
              text-sm
              text-(--parchment)
              transition-colors
              duration-200
              hover:text-(--gold-soft)
            "
            title={auth?.username || "Profile"}
          >
            {auth?.username || "Profile"}
          </button>

          {/* Sign out */}

          <button
            type="button"
            onClick={signOut}
            className="
              flex items-center gap-2
              rounded-[3px]
              border border-white/10
              px-3 py-2
              font-(--font-mono)
              text-[0.64rem]
              uppercase
              tracking-[0.08em]
              text-(--mauve)
              transition-colors
              duration-200
              hover:border-(--gold)
              hover:text-(--parchment)
            "
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>

        {/* -------------------------------------------------
            MOBILE MENU BUTTON
        ------------------------------------------------- */}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="
            rounded-[3px]
            p-2
            text-(--parchment)
            transition-colors
            duration-200
            hover:bg-(--velvet)
            md:hidden
          "
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* -------------------------------------------------
          MOBILE NAVIGATION
      ------------------------------------------------- */}

      {open && (
        <nav
          className="
            border-t border-white/10
            px-5 py-3
            md:hidden
          "
        >
          <div className="space-y-1">
            {items.map(([label, to, Icon]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/viewer"}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3",
                    "rounded-[3px]",
                    "px-3 py-3",
                    "font-(--font-mono)",
                    "text-[0.7rem]",
                    "uppercase",
                    "tracking-[0.08em]",
                    "transition-colors",
                    "duration-200",

                    isActive
                      ? "bg-(--velvet) text-(--gold-soft)"
                      : "text-(--mauve) hover:bg-white/5 hover:text-(--parchment)",
                  ].join(" ")
                }
              >
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>

          {/* Mobile Sign Out */}

          <button
            type="button"
            onClick={signOut}
            className="
              mt-2
              flex w-full
              items-center gap-3
              rounded-[3px]
              px-3 py-3
              font-(--font-mono)
              text-[0.7rem]
              uppercase
              tracking-[0.08em]
              text-(--mauve)
              transition-colors
              duration-200
              hover:bg-white/5
              hover:text-(--parchment)
            "
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </nav>
      )}
    </header>
  );
}