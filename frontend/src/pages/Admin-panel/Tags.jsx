import React, { useEffect, useMemo, useState } from "react";
import { Hash, Search, RefreshCw, Film, Tags as TagsIcon, CheckCircle2, ChevronRight, AlertCircle, Sparkles } from "lucide-react";
import { getRequest } from "../../api/client.js";

const cx = (...parts) => parts.filter(Boolean).join(" ");

export default function AdminTags() {
  const [data, setData] = useState({ tags: [], totalTags: 0, totalTaggedFilms: 0 });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("popular");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const result = await getRequest("/analytics/admin/tags");
      const next = { tags: Array.isArray(result?.tags) ? result.tags : [], totalTags: result?.totalTags || 0, totalTaggedFilms: result?.totalTaggedFilms || 0 };
      setData(next);
      setSelected((current) => current ? next.tags.find((tag) => tag.tag.toLowerCase() === current.tag.toLowerCase()) || null : null);
    } catch (e) {
      setError(e?.message || "Unable to load the tag catalogue.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tags = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = data.tags.filter((tag) => !q || tag.tag.toLowerCase().includes(q) || tag.films?.some((film) => film.title?.toLowerCase().includes(q)));
    return filtered.sort((a, b) => sort === "alphabetical" ? a.tag.localeCompare(b.tag) : sort === "least" ? a.filmCount - b.filmCount : b.filmCount - a.filmCount);
  }, [data.tags, search, sort]);

  const maxCount = Math.max(1, ...data.tags.map((tag) => tag.filmCount));

  return <div className="min-h-[calc(100vh-8rem)] space-y-6 text-[#efe7da]">
    <section className="relative overflow-hidden rounded-3xl border border-white/[.08] bg-[radial-gradient(ellipse_at_85%_0%,rgba(145,32,54,.23),transparent_38%),linear-gradient(135deg,#1b1419,#100d10_65%)] p-6 sm:p-8">
      <div className="absolute -right-10 -top-12 h-52 w-52 rounded-full border border-[#d9a653]/10" />
      <div className="absolute -right-2 -top-4 h-36 w-36 rounded-full border border-[#d9a653]/10" />
      <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d9a653]/20 bg-[#d9a653]/[.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-[#d9a653]"><TagsIcon size={13} /> Content taxonomy</div>
          <h1 className="font-(--font-display) text-3xl tracking-tight sm:text-4xl">Tags & discovery</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#b6a9ae]">See how film tags are used across the catalogue. Use tag coverage to spot popular themes, inconsistent naming and content discovery opportunities.</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-white/10 bg-white/[.04] px-4 text-sm font-semibold transition hover:border-[#d9a653]/40 hover:bg-white/[.07] disabled:opacity-60 md:self-auto"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh data</button>
      </div>
    </section>

    {error && <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[.07] p-4 text-sm text-red-200"><AlertCircle size={18} className="mt-0.5 shrink-0" /><div><b>Could not load tags</b><p className="mt-1 text-red-100/75">{error}</p><button onClick={() => load()} className="mt-2 font-semibold underline underline-offset-4">Try again</button></div></div>}

    <section className="grid gap-4 sm:grid-cols-3">
      <Metric icon={TagsIcon} label="Unique tags" value={data.totalTags} detail="Distinct tag labels in film metadata" />
      <Metric icon={Film} label="Tag assignments" value={data.totalTaggedFilms} detail="Film-to-tag associations" />
      <Metric icon={CheckCircle2} label="Published associations" value={data.tags.reduce((sum, tag) => sum + (tag.publishedCount || 0), 0)} detail="Associations on public approved films" />
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
      <div className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#171216]">
        <div className="flex flex-col gap-4 border-b border-white/[.07] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-base font-semibold">Tag catalogue</h2><p className="mt-1 text-xs text-[#81757b]">{tags.length} of {data.tags.length} tags shown</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 sm:w-56"><Search size={15} className="shrink-0 text-[#8b7c82]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tags or films" className="w-full bg-transparent text-sm outline-none placeholder:text-[#6f6268]" /></label>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#211a20] px-3 text-sm text-[#d9cfd2] outline-none"><option value="popular">Most used</option><option value="least">Least used</option><option value="alphabetical">A to Z</option></select>
          </div>
        </div>
        {loading ? <div className="grid min-h-56 place-items-center text-sm text-[#95878d]"><span className="flex items-center gap-2"><RefreshCw size={16} className="animate-spin" /> Loading tag data…</span></div> : tags.length ? <div className="divide-y divide-white/[.055]">{tags.map((tag, index) => <button key={tag.tag} onClick={() => setSelected(tag)} className={cx("group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[.035]", selected?.tag === tag.tag && "bg-[#d9a653]/[.06]")}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#d9a653]/15 bg-[#d9a653]/[.06] text-[#d9a653]"><Hash size={17} /></span>
          <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><b className="text-sm text-[#f0e7dc]">{tag.tag}</b>{tag.filmCount <= 1 && <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">Low coverage</span>}</span><span className="mt-2 block h-1.5 max-w-sm overflow-hidden rounded-full bg-white/[.06]"><span className="block h-full rounded-full bg-gradient-to-r from-[#7c1d31] to-[#d9a653]" style={{ width: `${Math.max(4, tag.filmCount / maxCount * 100)}%` }} /></span></span>
          <span className="shrink-0 text-right"><b className="block text-sm tabular-nums">{tag.filmCount}</b><small className="text-[10px] text-[#8b7d83]">films</small></span><ChevronRight size={16} className="shrink-0 text-[#65585f] transition group-hover:translate-x-0.5 group-hover:text-[#d9a653]" />
        </button>)}</div> : <div className="grid min-h-56 place-items-center px-6 text-center"><div><TagsIcon size={25} className="mx-auto text-[#76666d]" /><p className="mt-3 text-sm font-semibold">No tags found</p><p className="mt-1 text-xs text-[#8b7d83]">Try another search, or add tags to film metadata.</p></div></div>}
      </div>

      <aside className="rounded-2xl border border-white/[.08] bg-[#171216] p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[#d9a653]"><Sparkles size={16} /><span className="text-[10px] font-bold uppercase tracking-[.18em]">Tag insights</span></div>
        {selected ? <>
          <h2 className="mt-4 break-words font-(--font-display) text-2xl">#{selected.tag}</h2><p className="mt-2 text-sm text-[#95878d]">Used on {selected.filmCount} {selected.filmCount === 1 ? "film" : "films"}; {selected.publishedCount || 0} currently approved and public.</p>
          <div className="mt-5 space-y-3"><h3 className="text-xs font-bold uppercase tracking-wider text-[#b6a9ae]">Associated films</h3>{(selected.films || []).length ? selected.films.map((film, i) => <div key={`${film.title}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/[.06] bg-black/15 px-3 py-3"><span className="min-w-0 truncate text-sm">{film.title}</span><span className={cx("shrink-0 rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-wider", film.status === "approved" ? "bg-emerald-400/10 text-emerald-300" : film.status === "pending" ? "bg-amber-400/10 text-amber-200" : "bg-white/[.06] text-[#aaa0a4]")}>{film.status}</span></div>) : <p className="text-sm text-[#8b7d83]">No associated film details.</p>}{selected.filmCount > 8 && <p className="text-xs text-[#8b7d83]">Showing the first 8 associated films.</p>}</div>
          <button onClick={() => setSelected(null)} className="mt-5 text-xs font-semibold text-[#d9a653] hover:underline">Clear selection</button>
        </> : <div className="flex min-h-64 flex-col items-center justify-center text-center"><div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[.07] bg-white/[.025] text-[#88767e]"><Hash size={23} /></div><h2 className="mt-4 text-sm font-semibold">Select a tag</h2><p className="mt-2 max-w-xs text-xs leading-5 text-[#8b7d83]">Choose a tag from the catalogue to inspect how widely it is used and which films it describes.</p></div>}
        <div className="mt-6 rounded-xl border border-[#d9a653]/15 bg-[#d9a653]/[.045] p-4"><p className="text-xs font-semibold text-[#d9a653]">How this catalogue works</p><p className="mt-1.5 text-xs leading-5 text-[#a99ba1]">Tags are currently derived from the tags stored on film records. This page reports usage; it does not independently rename or delete tags, which could affect existing films.</p></div>
      </aside>
    </section>
  </div>;
}

function Metric({ icon: Icon, label, value, detail }) {
  return <article className="rounded-2xl border border-white/[.08] bg-[#171216] p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium text-[#a99ba1]">{label}</span><span className="grid h-9 w-9 place-items-center rounded-xl border border-[#d9a653]/15 bg-[#d9a653]/[.06] text-[#d9a653]"><Icon size={17} /></span></div><strong className="mt-4 block font-(--font-display) text-3xl tabular-nums">{Number(value || 0).toLocaleString("en-IN")}</strong><p className="mt-2 text-xs leading-5 text-[#81757b]">{detail}</p></article>;
}
