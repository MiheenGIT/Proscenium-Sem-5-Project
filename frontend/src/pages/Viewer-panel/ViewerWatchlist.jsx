import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import ViewerNav from "../../components/ViewerNav.jsx";
import { getRequest } from "../../api/client.js";

export default function ViewerWatchlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadWatchlist() {
      try {
        const data = await getRequest("/viewer/watchlist");
        setItems(data.videos || []);
      } catch (err) {
        setError(err.message || "Unable to load your watchlist.");
      } finally {
        setLoading(false);
      }
    }

    loadWatchlist();
  }, []);

  return (
    <div className="min-h-screen bg-(--stage) text-(--parchment)">
      <ViewerNav />

      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <p className="font-(--font-mono) text-[0.62rem] uppercase tracking-[0.14em] text-(--gold)">
          Saved for later
        </p>

        <h1 className="mb-8 font-(--font-display) text-4xl">
          Watchlist
        </h1>

        {error && (
          <div className="mb-5 border border-(--error)/40 px-4 py-3 text-sm text-(--error)">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-(--mauve)">Loading watchlist…</p>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-white/10 p-14 text-center">
            <h2 className="font-(--font-display) text-2xl">
              Your watchlist is empty.
            </h2>

            <Link
              to="/viewer"
              className="mt-3 inline-block text-sm text-(--gold-soft) transition-colors hover:text-(--gold)"
            >
              Find a film
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((video) => (
              <Link
                key={video.id}
                to={`/viewer/videos/${video.id}`}
                className="group overflow-hidden rounded-[3px] border border-white/10 bg-[#17131a] transition-colors hover:border-(--gold)"
              >
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-(--velvet) text-sm text-(--mauve)">
                    No image
                  </div>
                )}

                <div className="p-4">
                  <h3
                    className="truncate font-(--font-display) text-lg"
                    title={video.title}
                  >
                    {video.title}
                  </h3>

                  <p className="mt-2 font-(--font-mono) text-[0.58rem] uppercase tracking-[0.06em] text-(--mauve)">
                    {(video.genres || []).slice(0, 2).join(" · ")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}