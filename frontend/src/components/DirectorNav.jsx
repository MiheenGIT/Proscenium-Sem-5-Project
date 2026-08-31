import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  { to: "/director", label: "My Films", end: true },
  { to: "/director/upload", label: "Upload" },
  { to: "/director/profile", label: "Profile" },
];

export default function DirectorNav({ confirmBeforeLeave }) {
  const { auth, logout } = useAuth();
  const [open, setOpen] = useState(false);

  function guardedNavigate(e, to, navigate) {
    if (confirmBeforeLeave && !window.confirm("You have unsaved changes. Leave without saving?")) {
      e.preventDefault();
    }
  }

  return (
    <header className="border-b border-[rgba(239,231,218,0.16)] bg-[var(--stage)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-[var(--font-display)] text-xl font-medium tracking-wide text-[var(--gold-soft)]">
            Proscenium
          </span>
          <span className="font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--mauve)]">
            Director
          </span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={(e) => guardedNavigate(e, item.to)}
              className={({ isActive }) =>
                [
                  "rounded-[3px] px-3 py-2 font-[var(--font-mono)] text-[0.72rem] uppercase tracking-[0.08em] transition-colors",
                  isActive
                    ? "bg-[var(--velvet)] text-[var(--gold-soft)]"
                    : "text-[var(--mauve)] hover:text-[var(--parchment)]",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <span className="text-sm text-[var(--parchment)]">{auth.username}</span>
          <button
            onClick={logout}
            className="rounded-[3px] border border-[rgba(239,231,218,0.16)] px-4 py-1.5 font-[var(--font-body)] text-sm text-[var(--parchment)] transition-colors hover:border-[var(--gold)]"
          >
            Sign out
          </button>
        </div>

        <button className="text-[var(--parchment)] md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {open && (
        <nav className="flex flex-col border-t border-[rgba(239,231,218,0.16)] px-6 py-3 md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                [
                  "rounded-[3px] px-3 py-2 font-[var(--font-mono)] text-[0.72rem] uppercase tracking-[0.08em]",
                  isActive ? "bg-[var(--velvet)] text-[var(--gold-soft)]" : "text-[var(--mauve)]",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
          <button onClick={logout} className="mt-2 rounded-[3px] border border-[rgba(239,231,218,0.16)] px-4 py-1.5 text-left text-sm text-[var(--parchment)]">
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}