import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  { to: "/director", label: "My Films", end: true },
  { to: "/director/upload", label: "Upload" },
  { to: "/director/profile", label: "Profile" },
];

export default function DirectorNav({ confirmBeforeLeave = false }) {
  const { auth, logout } = useAuth();
  const [open, setOpen] = useState(false);

  function guardedNavigate(event) {
    if (!confirmBeforeLeave) return;

    const shouldLeave = window.confirm(
      "You have unsaved changes. Leave without saving?"
    );

    if (!shouldLeave) event.preventDefault();
  }

  const navClass = ({ isActive }) =>
    [
      "rounded-[3px] px-3 py-2 font-(--font-mono) text-[0.72rem] uppercase tracking-[0.08em] transition-colors",
      isActive
        ? "bg-(--velvet) text-(--gold-soft)"
        : "text-(--mauve) hover:text-(--parchment)",
    ].join(" ");

  return (
    <header className="border-b border-white/10 bg-(--stage)">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-(--font-display) text-xl font-medium tracking-wide text-(--gold-soft)">
            Proscenium
          </span>

          <span className="font-(--font-mono) text-[0.65rem] uppercase tracking-[0.16em] text-(--mauve)">
            Director
          </span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={guardedNavigate}
              className={navClass}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <span className="text-sm text-(--parchment)">
            {auth?.username}
          </span>

          <button
            type="button"
            onClick={logout}
            className="rounded-[3px] border border-white/10 px-4 py-1.5 font-(--font-body) text-sm text-(--parchment) transition-colors hover:border-(--gold)"
          >
            Sign out
          </button>
        </div>

        <button
          type="button"
          className="text-(--parchment) md:hidden"
          onClick={() => setOpen((current) => !current)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {open && (
        <nav className="flex flex-col border-t border-white/10 px-6 py-3 md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={(event) => {
                guardedNavigate(event);
                setOpen(false);
              }}
              className={({ isActive }) =>
                [
                  "rounded-[3px] px-3 py-2 font-(--font-mono) text-[0.72rem] uppercase tracking-[0.08em]",
                  isActive
                    ? "bg-(--velvet) text-(--gold-soft)"
                    : "text-(--mauve)",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={logout}
            className="mt-2 rounded-[3px] border border-white/10 px-4 py-1.5 text-left text-sm text-(--parchment)"
          >
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}