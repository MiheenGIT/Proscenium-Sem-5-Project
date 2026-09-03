import React, { useEffect, useState } from "react";
import {Bell,Menu,Search,X,} from "lucide-react";
import {useLocation,useNavigate,} from "react-router-dom";
import { getRequest } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { Avatar } from "./Sidebar.jsx";

export default function TopBar({ onMenu }) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!q.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);

      try {
        const data = await getRequest(
          `/viewer/videos/search?q=${encodeURIComponent(
            q.trim()
          )}&limit=6`
        );

        setResults(data.videos || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    setOpen(false);
    setMenu(false);
    setQ("");
  }, [location.pathname]);

  useEffect(() => {
    getRequest("/viewer/notifications")
      .then((data) => setUnread(data.unread || 0))
      .catch(() => {});
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-50 flex h-[76px] items-center gap-3 border-b border-white/[0.07] bg-[#100d10]/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <button
        onClick={onMenu}
        className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.04] text-[#d0c4c7] lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={17} />
      </button>

      <div className="relative max-w-xl flex-1">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 transition focus-within:border-[#d9a653]/35">
          <Search
            size={15}
            className="text-[#756a6f]"
          />

          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search films, stories, genres…"
            className="w-full bg-transparent text-xs text-[#efe7da] outline-none placeholder:text-[#6f6468]"
          />

          <button
            onClick={() => {
              setQ("");
              setOpen(false);
            }}
            className={`text-[#6f6468] ${
              q ? "" : "hidden"
            }`}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        </div>

        {open && q && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-2xl border border-white/10 bg-[#171216]/98 p-2 shadow-2xl backdrop-blur-xl">
            {loading ? (
              <div className="p-4 text-xs text-[#8b7c82]">
                Searching…
              </div>
            ) : results.length ? (
              results.map((video) => (
                <button
                  key={video.id}
                  onClick={() =>
                    navigate(`/viewer/videos/${video.id}`)
                  }
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.05]"
                >
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    className="h-11 w-16 rounded-lg object-cover"
                  />

                  <span className="min-w-0">
                    <b className="block truncate text-xs text-[#efe7da]">
                      {video.title}
                    </b>

                    <small className="text-[9px] text-[#8b7c82]">
                      {video.genres
                        ?.slice(0, 2)
                        .join(" • ")}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <div className="p-4 text-xs text-[#8b7c82]">
                No films found for “{q}”.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() =>
            navigate("/viewer/notifications")
          }
          className="relative grid h-9 w-9 place-items-center rounded-xl bg-white/[0.04] text-[#b8acb0] hover:text-[#d9a653]"
          aria-label="Notifications"
        >
          <Bell size={16} />

          {unread > 0 && (
            <span className="absolute right-1 top-1 grid min-w-3.5 place-items-center rounded-full bg-[#d9a653] px-1 text-[7px] font-bold text-[#100d10]">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenu((value) => !value)}
            className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-white/[0.04]"
            aria-expanded={menu}
          >
            <Avatar
              src={auth?.avatarUrl}
              name={auth?.username}
            />

            <span className="hidden max-w-24 truncate text-[11px] font-medium text-[#d9d0d2] sm:block">
              {auth?.username || "Viewer"}
            </span>
          </button>

          {menu && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-44 rounded-2xl border border-white/10 bg-[#171216] p-2 shadow-2xl">
              <button
                onClick={() => navigate("/viewer/profile")}
                className="w-full rounded-xl px-3 py-2.5 text-left text-[10px] text-[#b9aeb1] hover:bg-white/[0.05]"
              >
                Profile
              </button>

              <button
                onClick={() => navigate("/viewer/settings")}
                className="w-full rounded-xl px-3 py-2.5 text-left text-[10px] text-[#b9aeb1] hover:bg-white/[0.05]"
              >
                Settings
              </button>

              <button
                onClick={() => navigate("/viewer/watchlist")}
                className="w-full rounded-xl px-3 py-2.5 text-left text-[10px] text-[#b9aeb1] hover:bg-white/[0.05]"
              >
                Watchlist
              </button>

              <button
                onClick={() => {
                  logout();
                  navigate("/login", {
                    replace: true,
                  });
                }}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-[10px] text-[#e08a6b] hover:bg-white/[0.05]"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}