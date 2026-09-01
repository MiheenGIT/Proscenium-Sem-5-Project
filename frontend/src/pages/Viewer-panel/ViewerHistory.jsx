import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";

import ViewerNav from "../../components/ViewerNav.jsx";
import { deleteRequest, getRequest } from "../../api/client.js";

export default function ViewerHistory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadHistory() {
    setLoading(true);
    setError("");

    try {
      const data = await getRequest("/viewer/history?limit=100");

      setItems(data.videos || []);
    } catch (err) {
      setError(err.message || "Unable to load your watch history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function clearHistory() {
    const confirmed = window.confirm(
      "Clear your watch history?"
    );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await deleteRequest("/viewer/history");

      setItems([]);
    } catch (err) {
      setError(err.message || "Unable to clear your watch history.");
    }
  }

  function getProgress(progress) {
    return Math.min(100, Math.max(0, (progress || 0) * 100));
  }

  return (
    <div className="min-h-screen bg-(--stage) text-(--parchment)">
      <ViewerNav />

      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        {/* -------------------------------------------------
            PAGE HEADER
        ------------------------------------------------- */}

        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p
              className="
                font-(--font-mono)
                text-[0.62rem]
                uppercase
                tracking-[0.14em]
                text-(--gold)
              "
            >
              Your record
            </p>

            <h1
              className="
                font-(--font-display)
                text-4xl
                text-(--parchment)
              "
            >
              Watch history
            </h1>
          </div>

          {/* Clear history button */}

          {items.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="
                flex
                items-center
                gap-2
                border
                border-white/10
                px-3
                py-2
                font-(--font-mono)
                text-[0.62rem]
                uppercase
                tracking-[0.08em]
                text-(--mauve)
                transition-colors
                duration-200
                hover:border-(--error)
                hover:text-(--error)
              "
            >
              <Trash2 size={14} />

              <span>Clear</span>
            </button>
          )}
        </div>

        {/* -------------------------------------------------
            ERROR MESSAGE
        ------------------------------------------------- */}

        {error && (
          <div
            className="
              mb-5
              rounded-[3px]
              border
              border-(--error)/40
              px-4
              py-3
              text-sm
              text-(--error)
            "
          >
            {error}
          </div>
        )}

        {/* -------------------------------------------------
            LOADING STATE
        ------------------------------------------------- */}

        {loading && (
          <p className="text-(--mauve)">
            Loading history…
          </p>
        )}

        {/* -------------------------------------------------
            EMPTY STATE
        ------------------------------------------------- */}

        {!loading && items.length === 0 && (
          <div
            className="
              border
              border-dashed
              border-white/10
              p-14
              text-center
            "
          >
            <h2
              className="
                font-(--font-display)
                text-2xl
                text-(--parchment)
              "
            >
              No watch history yet.
            </h2>

            <Link
              to="/viewer"
              className="
                mt-3
                inline-block
                text-sm
                text-(--gold-soft)
                transition-colors
                duration-200
                hover:text-(--gold)
              "
            >
              Discover a film
            </Link>
          </div>
        )}

        {/* -------------------------------------------------
            HISTORY GRID
        ------------------------------------------------- */}

        {!loading && items.length > 0 && (
          <div
            className="
              grid
              gap-5
              sm:grid-cols-2
              lg:grid-cols-3
              xl:grid-cols-4
            "
          >
            {items.map((video) => {
              const progress = getProgress(video.progress);

              return (
                <Link
                  key={video.id}
                  to={`/viewer/videos/${video.id}`}
                  className="
                    group
                    overflow-hidden
                    rounded-[3px]
                    border
                    border-white/10
                    bg-[#17131a]
                    transition-all
                    duration-200
                    hover:-translate-y-0.5
                    hover:border-(--gold)
                  "
                >
                  {/* Thumbnail */}

                  <div className="aspect-video overflow-hidden bg-(--velvet)">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="
                          h-full
                          w-full
                          object-cover
                          transition-transform
                          duration-300
                          group-hover:scale-[1.02]
                        "
                      />
                    ) : (
                      <div
                        className="
                          flex
                          h-full
                          w-full
                          items-center
                          justify-center
                          text-(--mauve)
                        "
                      >
                        No image
                      </div>
                    )}
                  </div>

                  {/* Film information */}

                  <div className="p-4">
                    <h3
                      className="
                        truncate
                        font-(--font-display)
                        text-lg
                        text-(--parchment)
                      "
                      title={video.title}
                    >
                      {video.title}
                    </h3>

                    {/* Progress bar */}

                    <div
                      className="
                        mt-3
                        h-1
                        overflow-hidden
                        rounded-full
                        bg-white/10
                      "
                    >
                      <div
                        className="
                          h-full
                          rounded-full
                          bg-(--gold)
                          transition-all
                          duration-300
                        "
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>

                    {/* Progress text */}

                    <p
                      className="
                        mt-2
                        font-(--font-mono)
                        text-[0.58rem]
                        uppercase
                        tracking-[0.06em]
                        text-(--mauve)
                      "
                    >
                      {video.completed
                        ? "Completed"
                        : `${Math.round(progress)}% watched`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}