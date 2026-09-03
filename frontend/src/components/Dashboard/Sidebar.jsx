import React from "react";
import {Bookmark,Compass,Film,Globe2,Heart,History,Home,Languages,LogOut,Menu,Sparkles,Star,TrendingUp,User,Settings,X,} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const groups = [
  [
    "DISCOVER",
    [
      ["Home", "/viewer", Home],
      ["For You", "/viewer/for-you", Sparkles],
      ["Trending", "/viewer/trending", TrendingUp],
      ["Explore", "/viewer/explore", Compass],
    ],
  ],
  [
    "YOUR CINEMA",
    [
      ["Continue Watching", "/viewer#continue", Film],
      ["Watchlist", "/viewer/watchlist", Bookmark],
      ["History", "/viewer/history", History],
      ["Liked Videos", "/viewer/liked", Heart],
      ["My Reviews", "/viewer/reviews", Star],
    ],
  ],
  [
    "PERSONALIZE",
    [
      ["Genre Preferences", "/viewer/preferences/genres", Sparkles],
      ["Language Preferences", "/viewer/preferences/languages", Languages],
    ],
  ],
  [
    "ACCOUNT",
    [
      ["Profile", "/viewer/profile", User],
      ["Settings", "/viewer/settings", Settings],
      ["Help & Support", "/viewer/help", Globe2],
    ],
  ],
];

export default function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const name = auth?.username || "Viewer";

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <aside
        className={`fixed left-0 top-0 z-[70] hidden h-screen flex-col border-r border-white/[0.07] bg-[#100d10]/95 backdrop-blur-xl transition-all duration-300 lg:flex ${
          collapsed ? "w-[76px]" : "w-[240px]"
        }`}
      >
        <Brand
          collapsed={collapsed}
          onClick={() => navigate("/viewer")}
        />

        <div className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map(([title, items]) => (
            <div
              key={title}
              className="mb-6"
            >
              <p
                className={`mb-2 px-3 text-[8px] font-bold tracking-[.2em] text-[#6f6468] ${
                  collapsed ? "text-center" : ""
                }`}
              >
                {collapsed ? title.slice(0, 2) : title}
              </p>

              {items.map(([label, to, Icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/viewer"}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `group mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] transition ${
                      isActive
                        ? "bg-[#5c1220] text-[#e6c184] shadow-[inset_0_0_0_1px_rgba(217,166,83,.12)]"
                        : "text-[#95898e] hover:bg-white/[0.04] hover:text-[#efe7da]"
                    } ${collapsed ? "justify-center" : ""}`
                  }
                >
                  <Icon size={16} />

                  {!collapsed && (
                    <span className="truncate">
                      {label}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.07] p-3">
          <button
            onClick={() => navigate("/viewer/profile")}
            className={`flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.04] ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Avatar
              src={auth?.avatarUrl}
              name={name}
            />

            {!collapsed && (
              <span className="min-w-0">
                <b className="block truncate text-[11px] text-[#efe7da]">
                  {name}
                </b>

                <small className="text-[8px] uppercase tracking-[.16em] text-[#d9a653]">
                  Viewer
                </small>
              </span>
            )}
          </button>

          {!collapsed && (
            <button
              onClick={signOut}
              className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[10px] text-[#8f8388] hover:bg-white/[0.04] hover:text-[#efe7da]"
            >
              <LogOut size={14} />
              Sign out
            </button>
          )}
        </div>
      </aside>

      <button
        onClick={() => setCollapsed((value) => !value)}
        className="fixed left-3 top-4 z-[80] hidden h-9 w-9 place-items-center rounded-xl border border-white/10 bg-[#171216]/90 text-[#c6bbbe] backdrop-blur lg:grid"
        aria-label="Toggle sidebar"
      >
        <Menu size={16} />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            onClick={(event) => event.stopPropagation()}
            className="h-full w-[285px] border-r border-white/10 bg-[#100d10] p-4"
          >
            <div className="flex items-center justify-between">
              <Brand
                collapsed={false}
                onClick={() => {
                  navigate("/viewer");
                  setMobileOpen(false);
                }}
              />

              <button
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.05]"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-6">
              {groups.map(([title, items]) => (
                <div
                  key={title}
                  className="mb-5"
                >
                  <p className="mb-2 px-3 text-[8px] font-bold tracking-[.2em] text-[#6f6468]">
                    {title}
                  </p>

                  {items.map(([label, to, Icon]) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === "/viewer"}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-[11px] ${
                          isActive
                            ? "bg-[#5c1220] text-[#e6c184]"
                            : "text-[#95898e] hover:bg-white/[0.04]"
                        }`
                      }
                    >
                      <Icon size={16} />
                      {label}
                    </NavLink>
                  ))}
                </div>
              ))}
            </div>

            <button
              onClick={signOut}
              className="flex items-center gap-2 rounded-xl px-3 py-3 text-[11px] text-[#95898e]"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </aside>
        </div>
      )}
    </>
  );
}

function Brand({ collapsed, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-[76px] items-center gap-3 border-b border-white/[0.07] px-4 text-left ${
        collapsed ? "justify-center" : ""
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#5c1220] text-[#d9a653]">
        <Film size={17} />
      </span>

      {!collapsed && (
        <span>
          <b className="block font-[var(--font-display)] text-lg text-[#efe7da]">
            Proscenium
          </b>

          <small className="font-[var(--font-mono)] text-[7px] uppercase tracking-[.18em] text-[#71656a]">
            The Viewer House
          </small>
        </span>
      )}
    </button>
  );
}

function Avatar({ src, name }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#5c1220] text-xs font-bold text-[#e6c184]">
      {name?.[0]?.toUpperCase() || "V"}
    </span>
  );
}

export { Avatar };