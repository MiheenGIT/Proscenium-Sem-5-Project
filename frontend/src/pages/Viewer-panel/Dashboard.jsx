import React, {useEffect,useMemo,useState,} from "react";
import { useNavigate } from "react-router-dom";

import HeroBanner from "../../components/Dashboard/HeroBanner.jsx";
import MovieRow from "../../components/Dashboard/MovieRow.jsx";
import ActivityPanel from "../../components/Dashboard/ActivityPanel.jsx";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";

import { getRequest, postJson } from "../../api/client.js";
import { ErrorState,} from "../../components/common/States.jsx";

const fallbackGenres = [
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

const number = (value) => Number(value || 0);

function recommendationScore(
  video,
  profile,
  history,
  watchlist,
  liked
) {
  let score =
    number(video.avgRating) * 2 +
    number(video.views) / 1000;

  const preferredGenres =
    profile?.genrePreferences || [];

  const preferredLanguages =
    profile?.languagePreferences || [];

  if (
    preferredGenres.some((preferred) =>
      (video.genres || []).some(
        (genre) =>
          genre.toLowerCase() ===
          preferred.toLowerCase()
      )
    )
  ) {
    score += 12;
  }

  if (
    preferredLanguages.some(
      (language) =>
        language.toLowerCase() ===
        String(video.language || "").toLowerCase()
    )
  ) {
    score += 8;
  }

  if (
    history.some(
      (item) => item.id === video.id
    )
  ) {
    score += 4;
  }

  if (
    watchlist.some(
      (item) => item.id === video.id
    )
  ) {
    score += 3;
  }

  if (
    liked.some(
      (item) => item.id === video.id
    )
  ) {
    score += 6;
  }

  return score;
}

function HomeInner() {
  const navigate = useNavigate();

  const [videos, setVideos] = useState([]);
  const [history, setHistory] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [liked, setLiked] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [profile, setProfile] = useState(null);
  const [genres, setGenres] = useState([]);

  const [genre, setGenre] = useState("");
  const [hero, setHero] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const videoQuery =
        `/viewer/videos?limit=100` +
        (genre
          ? `&genre=${encodeURIComponent(genre)}`
          : "");

      /*
       * IMPORTANT:
       * /viewer/videos remains the source of truth.
       *
       * The backend decides whether a video is
       * approved/public. We do not alter that here.
       */
      const results = await Promise.allSettled([
        getRequest(videoQuery),
        getRequest("/viewer/history?limit=100"),
        getRequest("/viewer/watchlist"),
        getRequest("/viewer/profile"),
        getRequest("/viewer/genres"),
        getRequest("/viewer/liked"),
        getRequest("/viewer/reviews"),
      ]);

      const [
        videoResult,
        historyResult,
        watchlistResult,
        profileResult,
        genresResult,
        likedResult,
        reviewsResult,
      ] = results;

      /*
       * Only the video endpoint is required
       * for the dashboard to render.
       */
      if (videoResult.status === "rejected") {
        throw videoResult.reason;
      }

      const videoData =
        videoResult.value || {};

      setVideos(
        Array.isArray(videoData.videos)
          ? videoData.videos
          : []
      );

      if (historyResult.status === "fulfilled") {
        setHistory(
          historyResult.value?.videos || []
        );
      } else {
        setHistory([]);
      }

      if (watchlistResult.status === "fulfilled") {
        setWatchlist(
          watchlistResult.value?.videos || []
        );
      } else {
        setWatchlist([]);
      }

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value || null);
      } else {
        setProfile(null);
      }

      if (genresResult.status === "fulfilled") {
        setGenres(
          genresResult.value?.genres || []
        );
      } else {
        setGenres([]);
      }

      if (likedResult.status === "fulfilled") {
        setLiked(
          likedResult.value?.videos || []
        );
      } else {
        setLiked([]);
      }

      if (reviewsResult.status === "fulfilled") {
        setReviews(
          reviewsResult.value?.reviews || []
        );
      } else {
        setReviews([]);
      }
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load the Proscenium library."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [genre]);

  const savedIds = useMemo(
    () =>
      new Set(
        watchlist.map((video) => video.id)
      ),
    [watchlist]
  );

  const likedIds = useMemo(
    () =>
      new Set(
        liked.map((video) => video.id)
      ),
    [liked]
  );

  const continueWatching = useMemo(
    () =>
      history
        .filter(
          (video) =>
            !video.completed &&
            number(video.progress) > 0
        )
        .sort(
          (a, b) =>
            new Date(
              b.lastWatchedAt || 0
            ) -
            new Date(
              a.lastWatchedAt || 0
            )
        ),
    [history]
  );

  const featured = useMemo(
    () => videos.slice(0, 5),
    [videos]
  );

  const madeForYou = useMemo(
    () =>
      [...videos]
        .sort(
          (a, b) =>
            recommendationScore(
              b,
              profile,
              history,
              watchlist,
              liked
            ) -
            recommendationScore(
              a,
              profile,
              history,
              watchlist,
              liked
            )
        )
        .slice(0, 12),
    [
      videos,
      profile,
      history,
      watchlist,
      liked,
    ]
  );

  const trending = useMemo(
    () =>
      [...videos]
        .sort(
          (a, b) =>
            number(b.views) -
            number(a.views)
        )
        .slice(0, 12),
    [videos]
  );

  const newReleases = useMemo(
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
        .slice(0, 12),
    [videos]
  );

  const watchedGenres = useMemo(() => {
    const counts = {};

    history.forEach((video) => {
      (video.genres || []).forEach(
        (item) => {
          counts[item] =
            (counts[item] || 0) + 1;
        }
      );
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [history]);

  async function save(video) {
    try {
      const result = await postJson(
        `/viewer/videos/${video.id}/watchlist`,
        {
          saved: true,
        }
      );

      if (result?.saved) {
        setWatchlist((current) =>
          current.some(
            (item) => item.id === video.id
          )
            ? current
            : [video, ...current]
        );
      } else {
        setWatchlist((current) =>
          current.filter(
            (item) => item.id !== video.id
          )
        );
      }
    } catch (err) {
      setError(
        err?.message ||
          "Unable to update watchlist."
      );
    }
  }

  function onSaved(id, saved) {
    if (saved) {
      const video =
        videos.find(
          (item) => item.id === id
        ) ||
        history.find(
          (item) => item.id === id
        );

      if (video) {
        setWatchlist((current) =>
          current.some(
            (item) => item.id === id
          )
            ? current
            : [video, ...current]
        );
      }
    } else {
      setWatchlist((current) =>
        current.filter(
          (video) => video.id !== id
        )
      );
    }
  }

  function play(video) {
    navigate(
      `/viewer/videos/${video.id}`
    );
  }

  if (loading) {
    return (
      <main className="min-h-[70vh] px-5 py-8">
        <div className="h-[520px] animate-pulse rounded-3xl bg-white/[0.04]" />
      </main>
    );
  }

  if (error && !videos.length) {
    return (
      <main className="px-5 py-10">
        <ErrorState
          message={error}
          onRetry={load}
        />
      </main>
    );
  }

  const currentHero =
    featured.length > 0
      ? featured[
          hero % featured.length
        ]
      : null;

  return (
    <div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_280px]">
        <main className="min-w-0 overflow-hidden">
          <HeroBanner
            video={currentHero}
            saved={
              currentHero
                ? savedIds.has(
                    currentHero.id
                  )
                : false
            }
            onSave={save}
            onPlay={play}
            onInfo={(video) =>
              navigate(
                `/viewer/videos/${video.id}`
              )
            }
            index={hero}
            total={featured.length}
            onPrev={() =>
              featured.length &&
              setHero(
                (value) =>
                  (value -
                    1 +
                    featured.length) %
                  featured.length
              )
            }
            onNext={() =>
              featured.length &&
              setHero(
                (value) =>
                  (value + 1) %
                  featured.length
              )
            }
          />

          <div className="sticky top-[76px] z-30 border-b border-white/[0.06] bg-[#100d10]/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => setGenre("")}
                className={`shrink-0 rounded-full border px-4 py-2 text-[9px] font-semibold ${
                  !genre
                    ? "border-[#d9a653] bg-[#5c1220] text-[#e6c184]"
                    : "border-white/10 bg-white/[0.025] text-[#968b8f]"
                }`}
              >
                All
              </button>

              {(genres.length
                ? genres
                : fallbackGenres
              ).map((item) => (
                <button
                  key={item}
                  onClick={() =>
                    setGenre(
                      item === genre
                        ? ""
                        : item
                    )
                  }
                  className={`shrink-0 rounded-full border px-4 py-2 text-[9px] font-semibold ${
                    genre.toLowerCase() ===
                    item.toLowerCase()
                      ? "border-[#d9a653] bg-[#5c1220] text-[#e6c184]"
                      : "border-white/10 bg-white/[0.025] text-[#968b8f] hover:text-[#efe7da]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <MovieRow
            title="Continue Watching"
            subtitle="Pick up exactly where you left off."
            videos={continueWatching}
            savedIds={savedIds}
            likedIds={likedIds}
            onPlay={play}
            onSaved={onSaved}
          />

          <MovieRow
            title="Made For You"
            subtitle="Recommendations shaped by your viewing taste."
            videos={madeForYou}
            savedIds={savedIds}
            likedIds={likedIds}
            onPlay={play}
            onSaved={onSaved}
            onLiked={() => {}}
          />

          <MovieRow
            title={
              watchedGenres[0]
                ? `Because You Watched ${watchedGenres[0]}`
                : "Discover Your Next Story"
            }
            videos={
              watchedGenres.length
                ? madeForYou.filter(
                    (video) =>
                      video.genres?.some(
                        (item) =>
                          item.toLowerCase() ===
                          watchedGenres[0].toLowerCase()
                      )
                  )
                : madeForYou
            }
            savedIds={savedIds}
            likedIds={likedIds}
            onPlay={play}
            onSaved={onSaved}
          />

          <MovieRow
            title="Trending Now"
            subtitle="Popular across the Proscenium library."
            videos={trending}
            savedIds={savedIds}
            likedIds={likedIds}
            onPlay={play}
            onSaved={onSaved}
          />

          <MovieRow
            title="New on Proscenium"
            videos={newReleases}
            savedIds={savedIds}
            likedIds={likedIds}
            onPlay={play}
            onSaved={onSaved}
          />

          <MovieRow
            title="Your Watchlist"
            videos={watchlist}
            savedIds={savedIds}
            likedIds={likedIds}
            onPlay={play}
            onSaved={onSaved}
            action={
              <button
                onClick={() =>
                  navigate(
                    "/viewer/watchlist"
                  )
                }
                className="text-[9px] uppercase tracking-[.16em] text-[#d9a653]"
              >
                View all
              </button>
            }
          />
        </main>

        <ActivityPanel
          profile={profile}
          history={history}
          watchlist={watchlist}
          liked={liked}
          reviews={reviews}
          onPlay={play}
        />
      </div>
    </div>
  );
}

export default function ViewerDashboard() {
  return (
    <DashboardLayout>
      <HomeInner />
    </DashboardLayout>
  );
}