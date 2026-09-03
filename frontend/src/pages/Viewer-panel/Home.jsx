import React, {useEffect,useMemo,useState,} from "react";
import { useNavigate } from "react-router-dom";
import {Bell,Bookmark,Check,ChevronLeft,ChevronRight,Compass,Film,Globe2,History,Home,Menu,Play,Search,Settings,SlidersHorizontal,Sparkles,Star,ThumbsUp,User,X,} from "lucide-react";
import { getRequest, postJson, putJson,} from "../../api/client.js";

const DEFAULT_GENRES = [
  "Mystery",
  "Thriller",
  "Drama",
  "Comedy",
  "Horror",
  "Romance",
  "Action",
  "Sci-Fi",
  "Documentary",
];

const MOODS = [
  ["Mysterious", "Mystery"],
  ["Intense", "Thriller"],
  ["Emotional", "Drama"],
  ["Light", "Comedy"],
  ["Scary", "Horror"],
];

const cx = (...values) => values.filter(Boolean).join(" ");
const num = (value) => Number(value || 0);

function yearOf(video) {
  return (
    video?.releaseYear ||
    (video?.publishedAt
      ? new Date(video.publishedAt).getFullYear()
      : "")
  );
}

function progressOf(video) {
  const progress = num(video.progress);

  if (progress) {
    return Math.min(100, Math.round(progress * 100));
  }

  const duration = num(video.durationSec);

  return duration
    ? Math.min(
        100,
        Math.round(
          (num(video.currentTimeSec) / duration) * 100
        )
      )
    : 0;
}

function timeLeft(video) {
  const left = Math.max(
    0,
    num(video.durationSec) -
      num(video.currentTimeSec)
  );

  if (left < 60) {
    return `${Math.round(left)}s`;
  }

  const minutes = Math.round(left / 60);

  return minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h ${
        minutes % 60
      }m`;
}

function initials(name = "Viewer") {
  return (
    name.trim().charAt(0).toUpperCase() || "V"
  );
}

function FilmCard({
  video,
  saved,
  onPlay,
  onSave,
  reason,
}) {
  const progress = progressOf(video);

  return (
    <article className="group w-[190px] shrink-0 sm:w-[210px] lg:w-[220px]">
      <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#171216] shadow-[0_14px_45px_rgba(0,0,0,.2)] transition duration-300 group-hover:-translate-y-1 group-hover:border-[#d9a653]/40 group-hover:shadow-[0_18px_55px_rgba(0,0,0,.34)]">
        <button
          onClick={() => onPlay(video)}
          className="relative block aspect-[16/10] w-full overflow-hidden text-left"
          aria-label={`Play ${video.title}`}
        >
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.045]"
            />
          ) : (
            <div className="grid h-full place-items-center bg-[#251820] text-[#8b7c82]">
              <Film size={28} />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent opacity-80" />

          <span className="absolute bottom-3 left-3 grid h-8 w-8 place-items-center rounded-full bg-[#efe7da] text-[#100d10] opacity-0 shadow-lg transition group-hover:opacity-100">
            <Play
              size={14}
              fill="currentColor"
            />
          </span>

          {progress > 0 && (
            <span className="absolute bottom-0 left-0 h-1 w-full bg-white/10">
              <i
                className="block h-full bg-[#d9a653]"
                style={{
                  width: `${progress}%`,
                }}
              />
            </span>
          )}
        </button>

        <button
          onClick={(event) => {
            event.stopPropagation();
            onSave(video);
          }}
          className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/55 text-[#efe7da] backdrop-blur transition hover:border-[#d9a653]/60 hover:text-[#d9a653]"
          aria-label={
            saved
              ? "Remove from watchlist"
              : "Add to watchlist"
          }
        >
          {saved ? (
            <Check size={15} />
          ) : (
            <Bookmark size={15} />
          )}
        </button>
      </div>

      <div className="px-1 pt-3">
        <h3
          className="truncate font-[var(--font-body)] text-[13px] font-semibold text-[#efe7da]"
          title={video.title}
        >
          {video.title || "Untitled"}
        </h3>

        <div className="mt-1 flex items-center gap-2 text-[10px] text-[#8b7c82]">
          <span>{yearOf(video)}</span>

          {video.genres?.[0] && (
            <>
              <span>•</span>
              <span>{video.genres[0]}</span>
            </>
          )}

          {num(video.avgRating) > 0 && (
            <>
              <span>•</span>

              <span className="flex items-center gap-1 text-[#d9a653]">
                <Star
                  size={10}
                  fill="currentColor"
                />
                {num(video.avgRating).toFixed(1)}
              </span>
            </>
          )}
        </div>

        {reason && (
          <p className="mt-1 truncate text-[9px] text-[#8b7c82]">
            {reason}
          </p>
        )}
      </div>
    </article>
  );
}

function Rail({
  id,
  title,
  subtitle,
  videos,
  savedIds,
  onPlay,
  onSave,
}) {
  if (!videos.length) {
    return null;
  }

  return (
    <section
      id={id}
      className="scroll-mt-24 px-4 py-7 sm:px-6 lg:px-8"
    >
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-[var(--font-display)] text-[22px] font-semibold tracking-[-.02em] text-[#efe7da] sm:text-[25px]">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-[10px] text-[#8b7c82]">
              {subtitle}
            </p>
          )}
        </div>

        <span className="hidden text-[9px] uppercase tracking-[.18em] text-[#8b7c82] sm:block">
          {videos.length} titles
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((video) => (
          <FilmCard
            key={video.id}
            video={video}
            saved={savedIds.has(video.id)}
            onPlay={onPlay}
            onSave={onSave}
          />
        ))}
      </div>
    </section>
  );
}

export default function ViewerHome() {
  const navigate = useNavigate();

  const [videos, setVideos] = useState([]);
  const [history, setHistory] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [genres, setGenres] = useState([]);
  const [liked, setLiked] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [profile, setProfile] = useState(null);

  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);

  const [prefs, setPrefs] = useState(false);
  const [draftGenres, setDraftGenres] = useState([]);
  const [draftLanguages, setDraftLanguages] =
    useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [
        videosData,
        historyData,
        watchlistData,
        genresData,
        profileData,
        likedData,
        reviewsData,
      ] = await Promise.all([
        getRequest(
          `/viewer/videos?limit=100${
            genre
              ? `&genre=${encodeURIComponent(genre)}`
              : ""
          }`
        ),
        getRequest("/viewer/history?limit=100"),
        getRequest("/viewer/watchlist"),
        getRequest("/viewer/genres"),
        getRequest("/viewer/profile"),
        getRequest("/viewer/liked"),
        getRequest("/viewer/reviews"),
      ]);

      setVideos(videosData.videos || []);
      setHistory(historyData.videos || []);
      setWatchlist(
        watchlistData.videos || []
      );
      setGenres(genresData.genres || []);
      setProfile(profileData);
      setLiked(likedData.videos || []);
      setReviews(reviewsData.reviews || []);
    } catch (e) {
      setError(
        e.message || "Unable to load your cinema."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [genre]);

  useEffect(() => {
    if (videos.length < 2) {
      return;
    }

    const timer = setInterval(
      () =>
        setHeroIndex(
          (index) =>
            (index + 1) %
            Math.min(5, videos.length)
        ),
      7000
    );

    return () => clearInterval(timer);
  }, [videos.length]);

  useEffect(() => {
    const query = search.trim();

    if (!query) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await getRequest(
          `/viewer/videos/search?q=${encodeURIComponent(
            query
          )}&limit=30${
            genre
              ? `&genre=${encodeURIComponent(genre)}`
              : ""
          }`
        );

        setResults(data.videos || []);
      } catch (e) {
        setError(e.message || "Search failed.");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, genre]);

  const savedIds = useMemo(
    () => new Set(watchlist.map((video) => video.id)),
    [watchlist]
  );

  const watchedIds = useMemo(
    () => new Set(history.map((video) => video.id)),
    [history]
  );

  const preferred =
    profile?.genrePreferences || [];

  const preferredLang =
    profile?.languagePreferences || [];

  const watchedGenres = [
    ...new Set(
      history.flatMap(
        (video) => video.genres || []
      )
    ),
  ];

  const heroList = videos.slice(0, 5);
  const hero =
    heroList[heroIndex] || videos[0];

  const continueWatching = history
    .filter(
      (video) =>
        progressOf(video) > 0 &&
        !video.completed
    )
    .slice(0, 8);

  const languages = [
    ...new Set(
      videos
        .map((video) => video.language)
        .filter(Boolean)
    ),
  ].sort();

  const forYou = useMemo(() => {
    return videos
      .filter((video) => !watchedIds.has(video.id))
      .map((video) => {
        const genreScore = (
          video.genres || []
        ).reduce(
          (score, currentGenre) =>
            score +
            (preferred.some(
              (preference) =>
                preference.toLowerCase() ===
                String(
                  currentGenre
                ).toLowerCase()
            )
              ? 5
              : 0),
          0
        );

        const languageScore =
          preferredLang.some(
            (language) =>
              language.toLowerCase() ===
              String(
                video.language || ""
              ).toLowerCase()
          )
            ? 4
            : 0;

        return {
          video,
          score:
            genreScore +
            languageScore +
            num(video.avgRating) +
            Math.min(
              num(video.views) / 100000,
              3
            ),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((item) => item.video);
  }, [
    videos,
    watchedIds,
    preferred,
    preferredLang,
  ]);

  const because = useMemo(
    () =>
      videos
        .filter(
          (video) =>
            !watchedIds.has(video.id) &&
            video.genres?.some((currentGenre) =>
              watchedGenres.some(
                (watchedGenre) =>
                  watchedGenre.toLowerCase() ===
                  String(
                    currentGenre
                  ).toLowerCase()
              )
            )
        )
        .slice(0, 8),
    [videos, watchedIds, watchedGenres]
  );

  const trending = useMemo(
    () =>
      [...videos]
        .sort(
          (a, b) =>
            num(b.views) - num(a.views)
        )
        .slice(0, 8),
    [videos]
  );

  const newest = useMemo(
    () =>
      [...videos]
        .sort(
          (a, b) =>
            new Date(
              b.publishedAt || 0
            ) -
            new Date(
              a.publishedAt || 0
            )
        )
        .slice(0, 8),
    [videos]
  );

  const moodVideos = useMemo(
    () =>
      mood
        ? videos
            .filter((video) =>
              video.genres?.some(
                (currentGenre) =>
                  currentGenre.toLowerCase() ===
                  mood.toLowerCase()
              )
            )
            .slice(0, 8)
        : [],
    [videos, mood]
  );

  function play(video) {
    navigate(`/viewer/videos/${video.id}`);
  }

  async function save(video) {
    try {
      const data = await postJson(
        `/viewer/videos/${video.id}/watchlist`,
        {
          saved: !savedIds.has(video.id),
        }
      );

      setWatchlist((current) =>
        data.saved
          ? [
              video,
              ...current.filter(
                (item) => item.id !== video.id
              ),
            ]
          : current.filter(
              (item) => item.id !== video.id
            )
      );
    } catch (e) {
      setError(
        e.message || "Unable to update watchlist."
      );
    }
  }

  function section(id) {
    setMobileOpen(false);

    if (id === "home") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } else {
      document
        .getElementById(id)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }
  }

  function openPrefs() {
    setDraftGenres(preferred);
    setDraftLanguages(preferredLang);
    setPrefs(true);
    setMobileOpen(false);
  }

  async function savePrefs() {
    try {
      const data = await putJson(
        "/viewer/profile",
        {
          genrePreferences: draftGenres,
          languagePreferences: draftLanguages,
        }
      );

      setProfile(data);
      setPrefs(false);
    } catch (e) {
      setError(
        e.message || "Unable to save preferences."
      );
    }
  }

  const nav = [
    [
      "DISCOVER",
      [
        ["home", "Home", Home],
        ["foryou", "For You", Sparkles],
        ["trending", "Trending", Compass],
        ["explore", "Explore", Search],
      ],
    ],
    [
      "YOUR CINEMA",
      [
        ["continue", "Continue Watching", Play],
        ["watchlist", "Watchlist", Bookmark],
        ["history", "History", History],
        ["liked", "Liked Videos", ThumbsUp],
        ["reviews", "My Reviews", Star],
      ],
    ],
  ];

  return (
    <div className="min-h-screen bg-[var(--stage)] text-[var(--parchment)]">
      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={cx(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-white/[0.06] bg-[#120f12]/95 py-4 backdrop-blur-xl transition-all duration-300 md:z-30",
          collapsed
            ? "w-[76px]"
            : "w-[245px]",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between px-3">
          <button
            onClick={() => section("home")}
            className={cx(
              "flex items-center gap-3 text-left",
              collapsed && "mx-auto"
            )}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#5c1220] font-[var(--font-display)] text-xl font-bold text-[#d9a653]">
              P
            </span>

            {!collapsed && (
              <span className="font-[var(--font-display)] text-[15px] font-semibold tracking-[.18em] text-[#efe7da]">
                PROSCENIUM
              </span>
            )}
          </button>

          <button
            onClick={() =>
              setCollapsed((value) => !value)
            }
            className={cx(
              "hidden rounded-lg p-2 text-[#8b7c82] hover:bg-white/5 hover:text-[#efe7da]",
              !collapsed && "md:block"
            )}
            aria-label="Toggle navigation"
          >
            <Menu size={18} />
          </button>
        </div>

        <nav className="mt-8 flex-1 overflow-y-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {nav.map(([group, items]) => (
            <div
              key={group}
              className="mb-7"
            >
              {!collapsed && (
                <p className="mb-2 px-3 text-[8px] font-semibold uppercase tracking-[.2em] text-[#8b7c82]">
                  {group}
                </p>
              )}

              <div className="space-y-1">
                {items.map(
                  ([id, label, Icon]) => (
                    <button
                      key={id}
                      onClick={() => section(id)}
                      title={
                        collapsed
                          ? label
                          : undefined
                      }
                      className={cx(
                        "flex w-full items-center rounded-lg text-[#a79a9f] transition hover:bg-white/[0.05] hover:text-[#efe7da]",
                        collapsed
                          ? "justify-center px-2 py-3"
                          : "gap-3 px-3 py-2.5 text-left",
                        id === "home" &&
                          "bg-white/[0.045] text-[#d9a653]"
                      )}
                    >
                      <Icon
                        size={18}
                        strokeWidth={1.8}
                      />

                      {!collapsed && (
                        <span className="text-[11px] font-medium">
                          {label}
                        </span>
                      )}

                      {!collapsed &&
                        id === "watchlist" &&
                        watchlist.length > 0 && (
                          <span className="ml-auto rounded-full bg-[#5c1220] px-1.5 py-0.5 text-[8px] text-[#d9a653]">
                            {watchlist.length}
                          </span>
                        )}
                    </button>
                  )
                )}
              </div>
            </div>
          ))}

          <div className="mb-7">
            {!collapsed && (
              <p className="mb-2 px-3 text-[8px] font-semibold uppercase tracking-[.2em] text-[#8b7c82]">
                PERSONALIZE
              </p>
            )}

            <button
              onClick={openPrefs}
              title="Preferences"
              className={cx(
                "flex w-full items-center rounded-lg text-[#a79a9f] transition hover:bg-white/[0.05] hover:text-[#efe7da]",
                collapsed
                  ? "justify-center px-2 py-3"
                  : "gap-3 px-3 py-2.5 text-left"
              )}
            >
              <SlidersHorizontal
                size={18}
                strokeWidth={1.8}
              />

              {!collapsed && (
                <span className="text-[11px]">
                  Preferences
                </span>
              )}
            </button>

            <button
              onClick={openPrefs}
              title="Languages"
              className={cx(
                "mt-1 flex w-full items-center rounded-lg text-[#a79a9f] transition hover:bg-white/[0.05] hover:text-[#efe7da]",
                collapsed
                  ? "justify-center px-2 py-3"
                  : "gap-3 px-3 py-2.5 text-left"
              )}
            >
              <Globe2
                size={18}
                strokeWidth={1.8}
              />

              {!collapsed && (
                <span className="text-[11px]">
                  Languages
                </span>
              )}
            </button>
          </div>
        </nav>

        <div className="border-t border-white/[0.06] px-3 pt-3">
          <button
            onClick={() =>
              navigate("/viewer/profile")
            }
            title="Profile"
            className={cx(
              "flex w-full items-center rounded-lg text-[#a79a9f] hover:bg-white/[0.05] hover:text-[#efe7da]",
              collapsed
                ? "justify-center p-3"
                : "gap-3 px-3 py-2.5"
            )}
          >
            <User size={18} />

            {!collapsed && (
              <span className="text-[11px]">
                Profile
              </span>
            )}
          </button>

          <button
            onClick={() =>
              navigate("/viewer/profile")
            }
            title="Settings"
            className={cx(
              "mt-1 flex w-full items-center rounded-lg text-[#a79a9f] hover:bg-white/[0.05] hover:text-[#efe7da]",
              collapsed
                ? "justify-center p-3"
                : "gap-3 px-3 py-2.5"
            )}
          >
            <Settings size={18} />

            {!collapsed && (
              <span className="text-[11px]">
                Settings
              </span>
            )}
          </button>
        </div>
      </aside>

      <div
        className={cx(
          "transition-[padding] duration-300 md:pl-[76px]",
          !collapsed && "md:pl-[245px]"
        )}
      >
        <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-white/[0.05] bg-[#100d10]/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-[#efe7da] hover:bg-white/5 md:hidden"
          >
            <Menu size={21} />
          </button>

          <button
            onClick={() => section("home")}
            className="grid h-9 w-9 place-items-center rounded-lg bg-[#5c1220] font-[var(--font-display)] font-bold text-[#d9a653] md:hidden"
          >
            P
          </button>

          <div className="mx-auto flex h-10 max-w-2xl flex-1 items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.035] px-4 focus-within:border-[#d9a653]/40">
            <Search
              size={16}
              className="shrink-0 text-[#8b7c82]"
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search films, directors, genres..."
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#efe7da] outline-none placeholder:text-[#71666b]"
            />

            <SlidersHorizontal
              size={15}
              className="hidden text-[#8b7c82] sm:block"
            />
          </div>

          <button className="relative grid h-10 w-10 place-items-center rounded-full text-[#a79a9f] hover:bg-white/5 hover:text-[#efe7da]">
            <Bell size={17} />
          </button>

          <button
            onClick={() =>
              navigate("/viewer/profile")
            }
            className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.025] py-1 pl-1 pr-3 sm:flex"
          >
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#5c1220] text-[11px] font-semibold text-[#d9a653]">
                {initials(profile?.username)}
              </span>
            )}

            <span className="max-w-24 truncate text-[10px] text-[#efe7da]">
              {profile?.username || "Viewer"}
            </span>
          </button>
        </header>

        {error && (
          <div className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-[#e08a6b]/25 bg-[#e08a6b]/[0.06] px-3 py-2 text-[10px] text-[#e08a6b] sm:mx-6 lg:mx-8">
            <span>{error}</span>

            <button
              onClick={() => setError("")}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {search.trim() ? (
          <section className="px-4 py-8 sm:px-6 lg:px-8">
            <p className="text-[9px] uppercase tracking-[.22em] text-[#d9a653]">
              Discover
            </p>

            <h1 className="mt-2 font-[var(--font-display)] text-3xl text-[#efe7da]">
              Results for “{search}”
            </h1>

            {loading ? (
              <div className="py-20 text-center text-xs text-[#8b7c82]">
                Searching...
              </div>
            ) : results.length ? (
              <div className="mt-8 flex flex-wrap gap-5">
                {results.map((video) => (
                  <FilmCard
                    key={video.id}
                    video={video}
                    saved={savedIds.has(video.id)}
                    onPlay={play}
                    onSave={save}
                  />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-[#8b7c82]">
                No films found.
              </div>
            )}
          </section>
        ) : loading ? (
          <div className="grid min-h-[70vh] place-items-center text-xs text-[#8b7c82]">
            Loading your cinema...
          </div>
        ) : (
          <>
            {hero && (
              <section
                id="home"
                className="relative mx-3 mt-3 min-h-[470px] overflow-hidden rounded-2xl border border-white/[0.07] sm:mx-5 lg:mx-7 lg:min-h-[540px]"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${
                      hero.thumbnailUrl || ""
                    })`,
                  }}
                />

                <div className="absolute inset-0 bg-gradient-to-r from-[#100d10] via-[#100d10]/85 to-transparent" />

                <div className="absolute inset-0 bg-gradient-to-t from-[#100d10] via-transparent to-black/10" />

                <div className="relative flex min-h-[470px] max-w-2xl flex-col justify-end p-7 sm:p-10 lg:min-h-[540px] lg:p-14">
                  <div className="mb-3 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.2em] text-[#d9a653]">
                    <Sparkles size={13} />
                    Proscenium selection
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {hero.genres
                      ?.slice(0, 3)
                      .map((currentGenre) => (
                        <span
                          key={currentGenre}
                          className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[9px] text-[#d8cfd1] backdrop-blur"
                        >
                          {currentGenre}
                        </span>
                      ))}
                  </div>

                  <h1 className="max-w-xl font-[var(--font-display)] text-4xl font-semibold leading-[.95] tracking-[-.035em] text-[#efe7da] sm:text-5xl lg:text-6xl">
                    {hero.title}
                  </h1>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-[#b3a8ac]">
                    {num(hero.avgRating) > 0 && (
                      <span className="flex items-center gap-1.5 text-[#d9a653]">
                        <Star
                          size={13}
                          fill="currentColor"
                        />
                        {num(
                          hero.avgRating
                        ).toFixed(1)}
                      </span>
                    )}

                    {yearOf(hero) && (
                      <span>{yearOf(hero)}</span>
                    )}

                    {hero.language && (
                      <span>{hero.language}</span>
                    )}

                    {hero.durationSec && (
                      <span>
                        {Math.round(
                          num(
                            hero.durationSec
                          ) / 60
                        )}{" "}
                        min
                      </span>
                    )}
                  </div>

                  <p className="mt-4 max-w-xl text-[11px] leading-6 text-[#b7adb0] sm:text-[12px]">
                    {hero.description ||
                      "Discover a new story from the Proscenium collection."}
                  </p>

                  <div className="mt-6 flex items-center gap-2">
                    <button
                      onClick={() => play(hero)}
                      className="flex items-center gap-2 rounded-lg bg-[#efe7da] px-5 py-3 text-[10px] font-bold text-[#100d10] transition hover:bg-[#e6c184]"
                    >
                      <Play
                        size={14}
                        fill="currentColor"
                      />

                      {progressOf(hero)
                        ? "Continue"
                        : "Watch now"}
                    </button>

                    <button
                      onClick={() => save(hero)}
                      className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-black/30 text-[#efe7da] backdrop-blur hover:border-[#d9a653]/50 hover:text-[#d9a653]"
                    >
                      {savedIds.has(hero.id) ? (
                        <Check size={17} />
                      ) : (
                        <Bookmark size={17} />
                      )}
                    </button>
                  </div>
                </div>

                {heroList.length > 1 && (
                  <div className="absolute bottom-5 right-5 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 p-1 backdrop-blur">
                    <button
                      onClick={() =>
                        setHeroIndex(
                          (index) =>
                            (index -
                              1 +
                              heroList.length) %
                            heroList.length
                        )
                      }
                      className="grid h-7 w-7 place-items-center rounded-full text-[#efe7da] hover:bg-white/10"
                    >
                      <ChevronLeft size={15} />
                    </button>

                    {heroList.map(
                      (video, index) => (
                        <button
                          key={video.id}
                          onClick={() =>
                            setHeroIndex(index)
                          }
                          className={cx(
                            "h-1.5 rounded-full transition-all",
                            index === heroIndex
                              ? "w-6 bg-[#d9a653]"
                              : "w-1.5 bg-white/35"
                          )}
                        />
                      )
                    )}

                    <button
                      onClick={() =>
                        setHeroIndex(
                          (index) =>
                            (index + 1) %
                            heroList.length
                        )
                      }
                      className="grid h-7 w-7 place-items-center rounded-full text-[#efe7da] hover:bg-white/10"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </section>
            )}

            <div className="flex gap-2 overflow-x-auto px-4 py-5 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                "",
                ...(genres.length
                  ? genres
                  : DEFAULT_GENRES),
              ].map((currentGenre) => (
                <button
                  key={currentGenre || "all"}
                  onClick={() =>
                    setGenre(currentGenre)
                  }
                  className={cx(
                    "shrink-0 rounded-full border px-4 py-2 text-[9px] transition",
                    genre === currentGenre
                      ? "border-[#d9a653] bg-[#5c1220] text-[#e6c184]"
                      : "border-white/[0.08] bg-white/[0.025] text-[#9b9094] hover:border-white/15 hover:text-[#efe7da]"
                  )}
                >
                  {currentGenre || "All films"}
                </button>
              ))}
            </div>

            <Rail
              id="continue"
              title="Continue Watching"
              subtitle="Pick up exactly where you left off"
              videos={continueWatching}
              savedIds={savedIds}
              onPlay={play}
              onSave={save}
            />

            <Rail
              id="foryou"
              title="Made For You"
              subtitle={
                preferred.length
                  ? `Selected from your ${preferred
                      .slice(0, 3)
                      .join(
                        ", "
                      )} preferences`
                  : "A blend of rating, popularity and your viewing activity"
              }
              videos={forYou}
              savedIds={savedIds}
              onPlay={play}
              onSave={save}
            />

            {mood && (
              <Rail
                title={`${mood} picks`}
                subtitle="Based on the mood you selected"
                videos={moodVideos}
                savedIds={savedIds}
                onPlay={play}
                onSave={save}
              />
            )}

            <Rail
              id="explore"
              title="Because You Watched"
              subtitle="Stories connected to genres in your history"
              videos={because}
              savedIds={savedIds}
              onPlay={play}
              onSave={save}
            />

            <Rail
              id="trending"
              title="Trending Now"
              subtitle="The most-watched films in your current catalogue"
              videos={trending}
              savedIds={savedIds}
              onPlay={play}
              onSave={save}
            />

            <Rail
              title="New on Proscenium"
              subtitle="Recently published films"
              videos={newest}
              savedIds={savedIds}
              onPlay={play}
              onSave={save}
            />

            <Rail
              id="liked"
              title="Liked Videos"
              subtitle={`${liked.length} films you liked`}
              videos={liked}
              savedIds={savedIds}
              onPlay={play}
              onSave={save}
            />

            <section
              id="watchlist"
              className="mx-4 my-6 scroll-mt-24 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-5 sm:mx-6 lg:mx-8 lg:p-6"
            >
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="font-[var(--font-display)] text-[23px] text-[#efe7da]">
                    Your Watchlist
                  </h2>

                  <p className="mt-1 text-[10px] text-[#8b7c82]">
                    {watchlist.length} saved films
                  </p>
                </div>

                <button
                  onClick={() =>
                    navigate(
                      "/viewer/watchlist"
                    )
                  }
                  className="text-[9px] uppercase tracking-[.15em] text-[#d9a653]"
                >
                  Open watchlist
                </button>
              </div>

              {watchlist.length ? (
                <div className="mt-5 flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {watchlist
                    .slice(0, 8)
                    .map((video) => (
                      <FilmCard
                        key={video.id}
                        video={video}
                        saved
                        onPlay={play}
                        onSave={save}
                      />
                    ))}
                </div>
              ) : (
                <p className="py-10 text-center text-[11px] text-[#8b7c82]">
                  Save films with the bookmark button.
                </p>
              )}
            </section>

            <section
              id="history"
              className="mx-4 my-6 scroll-mt-24 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-5 sm:mx-6 lg:mx-8 lg:p-6"
            >
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="font-[var(--font-display)] text-[23px] text-[#efe7da]">
                    Watch History
                  </h2>

                  <p className="mt-1 text-[10px] text-[#8b7c82]">
                    Your recent viewing
                  </p>
                </div>

                <button
                  onClick={() =>
                    navigate("/viewer/history")
                  }
                  className="text-[9px] uppercase tracking-[.15em] text-[#d9a653]"
                >
                  Open history
                </button>
              </div>

              {history.length ? (
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {history
                    .slice(0, 6)
                    .map((video) => (
                      <button
                        key={video.id}
                        onClick={() =>
                          play(video)
                        }
                        className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-black/15 p-2.5 text-left transition hover:border-[#d9a653]/25 hover:bg-white/[0.025]"
                      >
                        <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-[#251820]">
                          {video.thumbnailUrl ? (
                            <img
                              src={
                                video.thumbnailUrl
                              }
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-[#8b7c82]">
                              <Film size={15} />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <strong className="block truncate text-[11px] text-[#efe7da]">
                            {video.title}
                          </strong>

                          <span className="mt-1 block text-[9px] text-[#8b7c82]">
                            {video.completed
                              ? "Completed"
                              : `${progressOf(
                                  video
                                )}% watched • ${timeLeft(
                                  video
                                )} left`}
                          </span>

                          <span className="mt-2 block h-0.5 w-full bg-white/10">
                            <i
                              className="block h-full bg-[#d9a653]"
                              style={{
                                width: `${progressOf(
                                  video
                                )}%`,
                              }}
                            />
                          </span>
                        </div>

                        <Play
                          size={14}
                          className="text-[#8b7c82]"
                        />
                      </button>
                    ))}
                </div>
              ) : (
                <p className="py-10 text-center text-[11px] text-[#8b7c82]">
                  Your watch history will appear here.
                </p>
              )}
            </section>

            <section
              id="reviews"
              className="mx-4 my-6 scroll-mt-24 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-5 sm:mx-6 lg:mx-8 lg:p-6"
            >
              <div>
                <h2 className="font-[var(--font-display)] text-[23px] text-[#efe7da]">
                  My Reviews
                </h2>

                <p className="mt-1 text-[10px] text-[#8b7c82]">
                  {reviews.length} reviews
                </p>
              </div>

              {reviews.length ? (
                <div className="mt-5 grid gap-2 md:grid-cols-2">
                  {reviews
                    .slice(0, 6)
                    .map((review) => (
                      <button
                        key={review.id}
                        onClick={() =>
                          play({
                            id: review.videoId,
                          })
                        }
                        className="flex gap-3 rounded-xl border border-white/[0.05] bg-black/15 p-3 text-left hover:border-[#d9a653]/25"
                      >
                        <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-[#251820]">
                          {review.thumbnailUrl && (
                            <img
                              src={
                                review.thumbnailUrl
                              }
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>

                        <div className="min-w-0">
                          <strong className="block truncate text-[11px] text-[#efe7da]">
                            {review.title}
                          </strong>

                          <span className="mt-1 block text-[10px] tracking-widest text-[#d9a653]">
                            {"★".repeat(
                              review.rating
                            )}
                            <span className="text-[#4d4548]">
                              {"★".repeat(
                                5 -
                                  review.rating
                              )}
                            </span>
                          </span>

                          <p className="mt-1 truncate text-[9px] text-[#8b7c82]">
                            {review.text}
                          </p>
                        </div>
                      </button>
                    ))}
                </div>
              ) : (
                <p className="py-10 text-center text-[11px] text-[#8b7c82]">
                  Your reviews will appear after you review a film.
                </p>
              )}
            </section>

            <section className="mx-4 my-7 flex flex-col gap-5 rounded-2xl border border-[#d9a653]/15 bg-gradient-to-r from-[#5c1220]/35 to-transparent p-5 sm:mx-6 sm:flex-row sm:items-center sm:justify-between lg:mx-8 lg:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d9a653]/10 text-[#d9a653]">
                  <Sparkles size={18} />
                </span>

                <div>
                  <h2 className="font-[var(--font-display)] text-lg text-[#efe7da]">
                    What are you in the mood for?
                  </h2>

                  <p className="mt-1 text-[10px] text-[#8b7c82]">
                    Tune your next rail without changing your saved preferences.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {MOODS.map(
                  ([label, value]) => (
                    <button
                      key={value}
                      onClick={() =>
                        setMood(
                          mood === value
                            ? ""
                            : value
                        )
                      }
                      className={cx(
                        "rounded-full border px-4 py-2 text-[9px] transition",
                        mood === value
                          ? "border-[#d9a653] bg-[#5c1220] text-[#e6c184]"
                          : "border-white/10 bg-black/10 text-[#a79a9f] hover:text-[#efe7da]"
                      )}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <aside className="fixed right-4 top-[84px] z-10 hidden w-[255px] space-y-3 xl:block">
        <div className="rounded-2xl border border-white/[0.06] bg-[#171216]/90 p-4 shadow-2xl backdrop-blur-xl">
          <p className="text-[8px] uppercase tracking-[.2em] text-[#d9a653]">
            Your cinema
          </p>

          <h2 className="mt-2 font-[var(--font-display)] text-xl text-[#efe7da]">
            Hi, {profile?.username || "Viewer"}
          </h2>

          <p className="mt-1 text-[10px] leading-5 text-[#8b7c82]">
            Your viewing activity, all in one place.
          </p>

          <div className="mt-4 grid grid-cols-4 divide-x divide-white/[0.06] border-t border-white/[0.06] pt-4">
            {[
              [history.length, "Watched"],
              [watchlist.length, "Saved"],
              [reviews.length, "Reviews"],
              [liked.length, "Liked"],
            ].map(([count, label]) => (
              <div
                key={label}
                className="px-2 text-center first:pl-0 last:pr-0"
              >
                <strong className="block text-sm text-[#efe7da]">
                  {count}
                </strong>

                <span className="mt-1 block text-[7px] uppercase tracking-wide text-[#8b7c82]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#171216]/90 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-[var(--font-display)] text-sm text-[#efe7da]">
              Watchlist
            </h3>

            <button
              onClick={() =>
                navigate(
                  "/viewer/watchlist"
                )
              }
              className="text-[8px] uppercase tracking-[.15em] text-[#d9a653]"
            >
              See all
            </button>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {watchlist
              .slice(0, 4)
              .map((video) => (
                <button
                  key={video.id}
                  onClick={() => play(video)}
                  className="aspect-[2/3] overflow-hidden rounded-md bg-[#251820]"
                >
                  {video.thumbnailUrl && (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}
          </div>

          {!watchlist.length && (
            <p className="py-5 text-center text-[9px] text-[#8b7c82]">
              No saved films yet.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#171216]/90 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-[var(--font-display)] text-sm text-[#efe7da]">
              Your taste
            </h3>

            <button
              onClick={openPrefs}
              className="text-[8px] uppercase tracking-[.15em] text-[#d9a653]"
            >
              Edit
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(preferred.length
              ? preferred
              : watchedGenres
            )
              .slice(0, 8)
              .map((currentGenre) => (
                <span
                  key={currentGenre}
                  className="rounded-full bg-[#5c1220]/60 px-2.5 py-1.5 text-[8px] text-[#e6c184]"
                >
                  {currentGenre}
                </span>
              ))}

            {!preferred.length &&
              !watchedGenres.length && (
                <p className="text-[9px] text-[#8b7c82]">
                  Choose genres to personalize recommendations.
                </p>
              )}
          </div>
        </div>
      </aside>

      {prefs && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4 backdrop-blur-md"
          onClick={() => setPrefs(false)}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#171216] p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-[.2em] text-[#d9a653]">
                  Personalize
                </p>

                <h2 className="mt-2 font-[var(--font-display)] text-2xl text-[#efe7da]">
                  Your cinema taste
                </h2>

                <p className="mt-1 text-[10px] text-[#8b7c82]">
                  Your selections feed the recommendation rails.
                </p>
              </div>

              <button
                onClick={() => setPrefs(false)}
                className="rounded-full p-2 text-[#8b7c82] hover:bg-white/5 hover:text-[#efe7da]"
              >
                <X size={18} />
              </button>
            </div>

            <h3 className="mt-7 text-[10px] font-semibold uppercase tracking-[.15em] text-[#b8aeb1]">
              Genres
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {(
                genres.length
                  ? genres
                  : DEFAULT_GENRES
              ).map((currentGenre) => {
                const selected =
                  draftGenres.some(
                    (value) =>
                      value.toLowerCase() ===
                      currentGenre.toLowerCase()
                  );

                return (
                  <button
                    key={currentGenre}
                    onClick={() =>
                      setDraftGenres(
                        selected
                          ? draftGenres.filter(
                              (value) =>
                                value.toLowerCase() !==
                                currentGenre.toLowerCase()
                            )
                          : [
                              ...draftGenres,
                              currentGenre,
                            ]
                      )
                    }
                    className={cx(
                      "flex items-center gap-1.5 rounded-full border px-3 py-2 text-[9px]",
                      selected
                        ? "border-[#d9a653] bg-[#5c1220] text-[#e6c184]"
                        : "border-white/10 text-[#9b9094]"
                    )}
                  >
                    {selected && (
                      <Check size={12} />
                    )}
                    {currentGenre}
                  </button>
                );
              })}
            </div>

            <h3 className="mt-7 text-[10px] font-semibold uppercase tracking-[.15em] text-[#b8aeb1]">
              Languages
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {languages.length ? (
                languages.map((language) => {
                  const selected =
                    draftLanguages.some(
                      (value) =>
                        value.toLowerCase() ===
                        language.toLowerCase()
                    );

                  return (
                    <button
                      key={language}
                      onClick={() =>
                        setDraftLanguages(
                          selected
                            ? draftLanguages.filter(
                                (value) =>
                                  value.toLowerCase() !==
                                  language.toLowerCase()
                              )
                            : [
                                ...draftLanguages,
                                language,
                              ]
                        )
                      }
                      className={cx(
                        "flex items-center gap-1.5 rounded-full border px-3 py-2 text-[9px]",
                        selected
                          ? "border-[#d9a653] bg-[#5c1220] text-[#e6c184]"
                          : "border-white/10 text-[#9b9094]"
                      )}
                    >
                      {selected && (
                        <Check size={12} />
                      )}
                      {language}
                    </button>
                  );
                })
              ) : (
                <p className="text-[9px] text-[#8b7c82]">
                  Languages will appear as films are published.
                </p>
              )}
            </div>

            <button
              onClick={savePrefs}
              className="mt-7 w-full rounded-lg bg-[#d9a653] px-4 py-3 text-[10px] font-bold text-[#100d10] transition hover:bg-[#e6c184]"
            >
              Save preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}