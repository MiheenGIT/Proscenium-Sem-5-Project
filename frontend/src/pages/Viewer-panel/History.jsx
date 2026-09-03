import React, { useEffect, useState } from "react";
import { Clock3, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { deleteRequest, getRequest } from "../../api/client.js";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import {EmptyState,ErrorState,PageLoading,} from "../../components/common/States.jsx";

const pct = (video) =>
  Math.min(
    100,
    Math.round(Number(video.progress || 0) * 100)
  );

export default function ViewerHistoryPro() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setRows(
        (
          await getRequest("/viewer/history?limit=100")
        ).videos || []
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function clear() {
    if (
      !window.confirm(
        "Clear your entire watch history?"
      )
    ) {
      return;
    }

    try {
      await deleteRequest("/viewer/history");
      setRows([]);
    } catch (error) {
      setError(error.message);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] uppercase tracking-[.22em] text-[#d9a653]">
              Your cinema
            </p>

            <h1 className="mt-2 font-[var(--font-display)] text-4xl text-[#efe7da]">
              History
            </h1>

            <p className="mt-2 text-sm text-[#8f8388]">
              Pick up a story or revisit something you finished.
            </p>
          </div>

          {rows.length > 0 && (
            <button
              onClick={clear}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-[10px] text-[#a79b9f] hover:border-red-300/20 hover:text-[#e08a6b]"
            >
              <Trash2 size={13} />
              Clear history
            </button>
          )}
        </div>

        {error && (
          <div className="mt-5">
            <ErrorState
              message={error}
              onRetry={load}
            />
          </div>
        )}

        {!rows.length && !error ? (
          <div className="mt-8">
            <EmptyState
              title="Your history is empty"
              message="Films you watch will appear here with their saved progress."
            />
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {rows.map((video) => {
              const progress = pct(video);

              return (
                <article
                  key={video.id}
                  className="flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 sm:p-4"
                >
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    className="h-24 w-40 rounded-xl object-cover sm:h-28 sm:w-48"
                  />

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-[var(--font-display)] text-lg text-[#efe7da]">
                      {video.title}
                    </h2>

                    <p className="mt-1 text-[10px] text-[#8f8388]">
                      {video.completed
                        ? "Completed"
                        : "In progress"}

                      {video.lastWatchedAt &&
                        ` • ${new Date(
                          video.lastWatchedAt
                        ).toLocaleDateString()}`}
                    </p>

                    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full bg-[#d9a653]"
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[9px] text-[#756a6f]">
                      <span>
                        {progress}% watched
                      </span>

                      <button
                        onClick={() =>
                          navigate(
                            `/viewer/videos/${video.id}`
                          )
                        }
                        className="rounded-lg bg-[#d9a653] px-3 py-1.5 font-bold text-[#100d10]"
                      >
                        {video.completed
                          ? "Watch again"
                          : "Continue"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}