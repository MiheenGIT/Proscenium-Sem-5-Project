import React, { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronRight,
  Clock3,
  Film,
  Heart,
  HelpCircle,
  Home,
  Languages,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Sparkles,
  UserRound,
  X,
  PlayCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getRequest } from "../api/client.js";
import "./ViewerNav.css";

export default function ViewerNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, logout } = useAuth();

  const [expanded, setExpanded] = useState(false);
  const [profile, setProfile] = useState(null);
  const [unread, setUnread] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      getRequest("/viewer/profile"),
      getRequest("/viewer/notifications"),
    ]).then(([profileResult, notificationResult]) => {
      if (!mounted) return;

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
      }

      if (notificationResult.status === "fulfilled") {
        setUnread(Number(notificationResult.value?.unread || 0));
      }
    });

    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const typing =
        ["INPUT", "TEXTAREA"].includes(e.target?.tagName) ||
        e.target?.isContentEditable;

      if (e.key === "/" && !typing && !searchOpen) {
        e.preventDefault();
        openSearch();
      }

      if (e.key === "Escape" && searchOpen) {
        closeSearch();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [searchOpen]);

  const username =
    profile?.username ||
    profile?.name ||
    auth?.username ||
    auth?.name ||
    "Viewer";

  const avatar =
    profile?.avatarUrl ||
    profile?.avatar ||
    auth?.avatarUrl ||
    auth?.avatar;

  const viewerId =
    profile?.id ||
    profile?._id ||
    profile?.userId ||
    auth?.userId ||
    auth?.id;

  /*
   * Keep the rail focused on destinations.
   * Trending, For You, New Releases, Genres, etc.
   * live on Home.
   */
  const main = [
    ["Home", "/viewer", Home],
  ];

  const library = [
    ["Watchlist", "/watchlist", Heart],
    ["History", "/history", Clock3],
  ];

  const profileItems = [
    ["Profile", "/profile", UserRound],
    ["Liked Videos", "/liked", Heart],
    ["My Reviews", "/reviews", MessageSquare],
    ["Notifications", "/notifications", Bell],
    ["Genres", "/preferences/genres", Sparkles],
    ["Languages", "/preferences/languages", Languages],
    ["Settings", "/settings", Settings],
    ["Help", "/help", HelpCircle],
  ];

  const isActive = (path) => {
    if (path === "/viewer") {
      return [
        "/viewer",
        "/dashboard",
        "/viewer/dashboard",
      ].includes(location.pathname);
    }

    return (
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`)
    );
  };

  function go(path) {
    setProfileOpen(false);
    navigate(path);
  }

  function openSearch() {
    setSearchOpen(true);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
    setSearchError("");
  }

  function changeQuery(value) {
    setQuery(value);

    clearTimeout(timerRef.current);

    if (!value.trim()) {
      setResults([]);
      setSearchError("");
      return;
    }

    timerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");

      try {
        const data = await getRequest(
          `/viewer/videos/search?q=${encodeURIComponent(
            value.trim()
          )}&limit=20`
        );

        setResults(
          Array.isArray(data?.videos)
            ? data.videos
            : Array.isArray(data)
              ? data
              : []
        );
      } catch (err) {
        setResults([]);
        setSearchError(
          err?.message ||
            "Search is temporarily unavailable."
        );
      } finally {
        setSearchLoading(false);
      }
    }, 280);
  }

  async function signOut() {
    setProfileOpen(false);

    await Promise.resolve(logout?.());

    navigate("/login", {
      replace: true,
    });
  }

  return (
    <>
      <aside
        className={`viewer-rail ${
          expanded ? "viewer-rail--expanded" : ""
        }`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* ================================================== */}
        {/* PROSCENIUM - ALWAYS AT THE TOP */}
        {/* ================================================== */}

        <button
          className="viewer-brand"
          onClick={() => go("/viewer")}
          aria-label="Proscenium Home"
        >
          <span className="viewer-brand__mark">
            <Film size={18} />
          </span>

          <span className="viewer-brand__text">
            PROSCENIUM
          </span>
        </button>

        {/* ================================================== */}
        {/* CENTER NAVIGATION */}
        {/* ================================================== */}

        <div className="viewer-nav-center">
          {/* Primary Navigation */}

          <nav
            className="viewer-nav-group"
            aria-label="Primary navigation"
          >
            {main.map(([label, path, Icon]) => (
              <button
                key={path}
                className={`viewer-nav-item ${
                  isActive(path) ? "is-active" : ""
                }`}
                onClick={() => go(path)}
                title={!expanded ? label : undefined}
              >
                <span className="viewer-nav-icon">
                  <Icon
                    size={19}
                    strokeWidth={1.65}
                  />
                </span>

                <span className="viewer-nav-label">
                  {label}
                </span>

                {isActive(path) && (
                  <span className="viewer-nav-active" />
                )}
              </button>
            ))}
          </nav>

          {/* Search */}

          <button
            className="viewer-nav-item viewer-search-trigger"
            onClick={openSearch}
            title={!expanded ? "Search" : undefined}
          >
            <span className="viewer-nav-icon">
              <Search
                size={19}
                strokeWidth={1.65}
              />
            </span>

            <span className="viewer-nav-label">
              Search
            </span>

            <span className="viewer-search-key">
              /
            </span>
          </button>

          <div className="viewer-divider" />

          {/* Library */}

          <nav
            className="viewer-nav-group"
            aria-label="Library"
          >
            {library.map(([label, path, Icon]) => (
              <button
                key={path}
                className={`viewer-nav-item ${
                  isActive(path) ? "is-active" : ""
                }`}
                onClick={() => go(path)}
                title={!expanded ? label : undefined}
              >
                <span className="viewer-nav-icon">
                  <Icon
                    size={19}
                    strokeWidth={1.65}
                  />
                </span>

                <span className="viewer-nav-label">
                  {label}
                </span>

                {isActive(path) && (
                  <span className="viewer-nav-active" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* ================================================== */}
        {/* PROFILE - ALWAYS AT THE BOTTOM */}
        {/* ================================================== */}

        <div className="viewer-rail-bottom">
          <div className="viewer-divider" />

          <div className="viewer-profile-wrap">
            {profileOpen && (
              <div className="viewer-profile-menu">
                <div className="viewer-profile-head">
                  <strong>{username}</strong>

                  <small>
                    Viewer ID ·{" "}
                    {viewerId
                      ? String(viewerId).slice(-8)
                      : "—"}
                  </small>
                </div>

                {profileItems.map(
                  ([label, path, Icon]) => (
                    <button
                      key={path}
                      className="viewer-profile-item"
                      onClick={() => go(path)}
                    >
                      <Icon
                        size={16}
                        strokeWidth={1.5}
                      />

                      <span>{label}</span>

                      {label === "Notifications" &&
                        unread > 0 && (
                          <b>{unread}</b>
                        )}
                    </button>
                  )
                )}

                <button
                  className="viewer-profile-item viewer-profile-logout"
                  onClick={signOut}
                >
                  <LogOut
                    size={16}
                    strokeWidth={1.5}
                  />

                  <span>Logout</span>
                </button>
              </div>
            )}

            <button
              className={`viewer-profile-button ${
                isActive("/profile")
                  ? "is-active"
                  : ""
              }`}
              onClick={() =>
                setProfileOpen((v) => !v)
              }
              title={!expanded ? "Profile" : undefined}
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="viewer-avatar"
                />
              ) : (
                <span className="viewer-avatar viewer-avatar--fallback">
                  <UserRound size={17} />
                </span>
              )}

              <span className="viewer-profile-copy">
                <strong>{username}</strong>
                <small>Viewer</small>
              </span>

              <ChevronRight
                size={15}
                className={`viewer-profile-chevron ${
                  profileOpen ? "open" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </aside>

      {/* ================================================== */}
      {/* TOP RIGHT UTILITY */}
      {/* ================================================== */}

      <div className="viewer-top-utility">
        <button
          onClick={() => go("/notifications")}
          aria-label="Notifications"
          className="viewer-utility-button"
        >
          <Bell size={18} />

          {unread > 0 && (
            <span>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        <button
          onClick={() => go("/profile")}
          aria-label="Profile"
          className="viewer-utility-avatar"
        >
          {avatar ? (
            <img src={avatar} alt="" />
          ) : (
            <UserRound size={17} />
          )}
        </button>
      </div>

      {/* ================================================== */}
      {/* SEARCH OVERLAY */}
      {/* ================================================== */}

      {searchOpen && (
        <div className="viewer-search-overlay">
          <button
            className="viewer-search-backdrop"
            onClick={closeSearch}
            aria-label="Close search"
          />

          <section className="viewer-search-panel">
            <header className="viewer-search-head">
              <div>
                <span>
                  PROSCENIUM DISCOVERY
                </span>

                <h1>
                  What do you want to watch today?
                </h1>
              </div>

              <button
                onClick={closeSearch}
                className="viewer-search-close"
                aria-label="Close search"
              >
                <X size={19} />
              </button>
            </header>

            <div className="viewer-search-box">
              <Search size={22} />

              <input
                ref={inputRef}
                value={query}
                onChange={(e) =>
                  changeQuery(e.target.value)
                }
                placeholder="Search films, videos, titles..."
                autoComplete="off"
              />

              {query && (
                <button
                  onClick={() => changeQuery("")}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}

              <kbd>ESC</kbd>
            </div>

            <div className="viewer-search-content">
              {!query.trim() &&
                !searchLoading && (
                  <div className="viewer-search-empty">
                    <Search size={30} />

                    <h2>
                      Search the Proscenium library
                    </h2>

                    <p>
                      Search directly by video or film
                      name.
                    </p>
                  </div>
                )}

              {searchLoading && (
                <div className="viewer-search-empty">
                  <span className="viewer-spinner" />

                  <h2>Searching…</h2>
                </div>
              )}

              {searchError && (
                <p className="viewer-search-error">
                  {searchError}
                </p>
              )}

              {!searchLoading &&
                !searchError &&
                query.trim() &&
                !results.length && (
                  <div className="viewer-search-empty">
                    <Film size={30} />

                    <h2>
                      No results found
                    </h2>

                    <p>
                      Try another film or video name.
                    </p>
                  </div>
                )}

              {!!results.length && (
                <div>
                  <p className="viewer-results-count">
                    {results.length} result
                    {results.length === 1
                      ? ""
                      : "s"}
                  </p>

                  <div className="viewer-search-grid">
                    {results.map((video) => {
                      const id =
                        video.id || video._id;

                      return (
                        <button
                          key={id}
                          className="viewer-search-card"
                          onClick={() => {
                            closeSearch();

                            navigate(
                              `/viewer/videos/${id}`
                            );
                          }}
                        >
                          <div className="viewer-search-thumb">
                            {video.thumbnailUrl ||
                            video.thumbnail ? (
                              <img
                                src={
                                  video.thumbnailUrl ||
                                  video.thumbnail
                                }
                                alt=""
                              />
                            ) : (
                              <Film size={25} />
                            )}

                            <span>
                              <PlayCircle
                                size={30}
                              />
                            </span>
                          </div>

                          <h3>
                            {video.title ||
                              "Untitled video"}
                          </h3>

                          <small>
                            {video.releaseYear || ""}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}