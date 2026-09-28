import React, { useEffect, useMemo, useState } from "react";
import { PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getRequest } from "../../api/client.js";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import { EmptyState, ErrorState, PageLoading } from "../../components/common/States.jsx";

const pct = (video) => Math.min(100, Math.round(Number(video.progress || 0) * 100));

export default function ContinueWatching() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getRequest("/viewer/history?limit=100");
      setRows((data?.videos || []).filter((video) => !video.completed && Number(video.progress || 0) > 0));
    } catch (err) {
      setError(err?.message || "Unable to load continue watching.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(b.lastWatchedAt || 0) - new Date(a.lastWatchedAt || 0)),
    [rows]
  );

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-[1400px] px-5 py-10 lg:px-10 lg:py-12">
        <p className="text-[9px] uppercase tracking-[.22em] text-[#d9a653]">Your cinema</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-[var(--font-display)] text-4xl tracking-[-.025em] text-[#efe7da] sm:text-5xl">Continue Watching</h1>
            <p className="mt-2 max-w-xl text-sm text-[#8f8388]">Pick up exactly where you left off.</p>
          </div>
          <button onClick={() => navigate("/history")} className="hidden rounded-full border border-white/10 px-4 py-2 text-[10px] font-semibold text-[#b9adb1] hover:border-[#d9a653]/35 hover:text-[#efe7da] sm:block">View history</button>
        </div>

        {loading ? <div className="mt-8"><PageLoading /></div> : error ? <div className="mt-8"><ErrorState message={error} onRetry={load} /></div> : !sorted.length ? (
          <div className="mt-8"><EmptyState title="Nothing to continue" message="Videos you start watching will appear here with their progress." /></div>
        ) : (
          <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((video) => {
              const progress = pct(video);
              return (
                <article key={video.id} className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] transition hover:-translate-y-1 hover:border-[#d9a653]/30">
                  <button type="button" onClick={() => navigate(`/viewer/videos/${video.id}`)} className="relative block aspect-video w-full overflow-hidden text-left">
                    <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute bottom-4 left-4 grid h-10 w-10 place-items-center rounded-full bg-[#efe7da] text-[#100d10] shadow-lg"><PlayCircle size={18} fill="currentColor" /></span>
                  </button>
                  <div className="p-4">
                    <h2 className="truncate font-[var(--font-display)] text-xl text-[#efe7da]">{video.title}</h2>
                    <p className="mt-1 text-[10px] text-[#8f8388]">{progress}% watched</p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#d9a653]" style={{ width: `${progress}%` }} /></div>
                    <button type="button" onClick={() => navigate(`/viewer/videos/${video.id}`)} className="mt-4 w-full rounded-xl bg-[#d9a653] px-4 py-2.5 text-[11px] font-bold text-[#100d10] transition hover:bg-[#e6c184]">Continue Watching</button>
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
