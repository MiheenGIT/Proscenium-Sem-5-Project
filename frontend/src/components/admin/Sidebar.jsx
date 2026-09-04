import React from "react";
import {
  Film,
  LayoutDashboard,
  MessageSquare,
  Menu,
  ShieldCheck,
  X,
  LogOut,
} from "lucide-react";
import {
  NavLink,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const items = [
  ["Dashboard", "/admin", LayoutDashboard],
  ["Content", "/admin/content", Film],
  ["Review", "/admin/review", ShieldCheck],
  ["Comments", "/admin/comments", MessageSquare],
];

export default function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function signOut() {
    logout();
    navigate("/login", {
      replace: true,
    });
  }

  const navigation = (
    <>
      <div className="flex h-19 items-center border-b border-white/[0.07] px-4">
        <button
          onClick={() =>
            setCollapsed?.(!collapsed)
          }
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label="Toggle sidebar"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#5c1220] text-[#d9a653]">
            <Film size={17} />
          </span>

          {!collapsed && (
            <span className="min-w-0">
              <b className="block truncate font-(--font-display) text-lg text-[#efe7da]">
                Proscenium
              </b>

              <small className="font-(--font-mono) text-[7px] uppercase tracking-[.18em] text-[#71656a]">
                Admin House
              </small>
            </span>
          )}
        </button>

        {mobileOpen && (
          <button
            onClick={() =>
              setMobileOpen(false)
            }
            className="ml-2 grid h-9 w-9 place-items-center rounded-xl bg-white/5 lg:hidden"
            aria-label="Close navigation"
          >
            <X size={17} />
          </button>
        )}
      </div>

      <nav className="px-3 py-5">
        <p
          className={`mb-3 px-2 text-[8px] font-bold tracking-[.2em] text-[#6f6468] ${
            collapsed ? "text-center" : ""
          }`}
        >
          MANAGE
        </p>

        {items.map(
          ([label, to, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin"}
              onClick={() =>
                setMobileOpen(false)
              }
              title={
                collapsed
                  ? label
                  : undefined
              }
              className={({ isActive }) =>
                `mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-[11px] transition ${
                  isActive
                    ? "bg-[#5c1220] text-[#e6c184]"
                    : "text-[#95898e] hover:bg-white/4 hover:text-[#efe7da]"
                } ${
                  collapsed
                    ? "justify-center"
                    : ""
                }`
              }
            >
              <Icon size={16} />

              {!collapsed && label}
            </NavLink>
          )
        )}
      </nav>

      <div className="mt-auto border-t border-white/[0.07] p-3">
        <button
          onClick={signOut}
          title={
            collapsed
              ? "Sign out"
              : undefined
          }
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[11px] text-[#95898e] hover:bg-white/4 hover:text-[#e08a6b] ${
            collapsed
              ? "justify-center"
              : ""
          }`}
        >
          <LogOut size={15} />

          {!collapsed && "Sign out"}
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-white/[0.07] bg-[#100d10] transition-[width] duration-300 lg:flex ${
          collapsed
            ? "w-19"
            : "w-60"
        }`}
      >
        {navigation}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-60 lg:hidden">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() =>
              setMobileOpen(false)
            }
            aria-label="Close navigation"
          />

          <aside className="relative flex h-full w-62.5 flex-col border-r border-white/8 bg-[#100d10] shadow-2xl">
            {navigation}
          </aside>
        </div>
      )}

      <button
        onClick={() =>
          setMobileOpen(true)
        }
        className="fixed left-4 top-4 z-40 grid h-9 w-9 place-items-center rounded-xl border border-white/8 bg-[#171216] text-[#d9d0d2] lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={17} />
      </button>
    </>
  );
}