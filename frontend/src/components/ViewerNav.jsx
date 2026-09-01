import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Film, History, Bookmark, User, LogOut, Menu, X, Search } from "lucide-react";
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

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(239,231,218,0.12)] bg-[rgba(16,13,16,0.96)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <button onClick={() => navigate("/viewer")} className="flex items-center gap-3 text-left">
          <span className="grid h-9 w-9 place-items-center rounded-[3px] bg-[var(--velvet)] text-[var(--gold)]"><Film size={18} /></span>
          <span>
            <span className="block font-[var(--font-display)] text-xl text-[var(--parchment)]">Proscenium</span>
            <span className="block font-[var(--font-mono)] text-[0.58rem] uppercase tracking-[0.14em] text-[var(--mauve)]">The Viewer House</span>
          </span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {items.map(([label, to, Icon]) => (
            <NavLink key={to} to={to} end={to === "/viewer"} className={({ isActive }) =>
              `flex items-center gap-2 rounded-[3px] px-3 py-2 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.08em] transition ${isActive ? "bg-[var(--velvet)] text-[var(--gold-soft)]" : "text-[var(--mauve)] hover:text-[var(--parchment)]"}`
            }>
              <Icon size={15} />{label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button onClick={() => navigate("/viewer?focus=search")} className="rounded-[3px] border border-[rgba(239,231,218,0.14)] p-2 text-[var(--mauve)] hover:border-[var(--gold)] hover:text-[var(--gold-soft)]" aria-label="Search">
            <Search size={17} />
          </button>
          <button onClick={() => navigate("/viewer/profile")} className="max-w-32 truncate text-sm text-[var(--parchment)]">{auth?.username}</button>
          <button onClick={signOut} className="flex items-center gap-2 rounded-[3px] border border-[rgba(239,231,218,0.14)] px-3 py-2 font-[var(--font-mono)] text-[0.64rem] uppercase tracking-[0.08em] text-[var(--mauve)] hover:border-[var(--gold)] hover:text-[var(--parchment)]">
            <LogOut size={14} /> Sign out
          </button>
        </div>

        <button className="md:hidden text-[var(--parchment)]" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && <nav className="border-t border-[rgba(239,231,218,0.12)] px-5 py-3 md:hidden">
        {items.map(([label, to, Icon]) => (
          <NavLink key={to} to={to} end={to === "/viewer"} onClick={() => setOpen(false)} className={({ isActive }) =>
            `flex items-center gap-3 rounded-[3px] px-3 py-3 font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.08em] ${isActive ? "bg-[var(--velvet)] text-[var(--gold-soft)]" : "text-[var(--mauve)]"}`
          }><Icon size={16} />{label}</NavLink>
        ))}
        <button onClick={signOut} className="mt-2 flex w-full items-center gap-3 rounded-[3px] px-3 py-3 font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.08em] text-[var(--mauve)]"><LogOut size={16} /> Sign out</button>
      </nav>}
    </header>
  );
}
