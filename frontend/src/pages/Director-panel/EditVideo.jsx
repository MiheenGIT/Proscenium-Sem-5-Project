import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DirectorNav from "../../components/DirectorNav.jsx";
import { getRequest, putForm, postForm, postEmpty } from "../../api/client";
import {
  Film,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  AlignLeft,
  Tags as TagsIcon,
  Globe2,
  CalendarDays,
  Image as ImageIcon,
  Users,
} from "lucide-react";
import Hls from "hls.js";

const GENRE_OPTIONS = [
  "Drama", "Comedy", "Thriller", "Horror", "Documentary",
  "Sci-Fi", "Romance", "Animation", "Action", "Experimental",
];

function StatusIcon({ status }) {
  if (status === "approved") return <ShieldCheck size={14} className="text-[#7fc59b]" />;
  if (status === "rejected") return <ShieldAlert size={14} className="text-[#e08a6b]" />;
  return <ShieldQuestion size={14} className="text-[var(--gold)]" />;
}

function StatusBadge({ status }) {
  const styles = {
    approved: "border-[var(--gold)] text-[var(--gold-soft)] bg-[rgba(217,166,83,0.08)]",
    pending: "border-[rgba(239,231,218,0.2)] text-[var(--mauve)] bg-transparent",
    rejected: "border-[var(--error)] text-[var(--error)] bg-[rgba(224,138,107,0.08)]",
  };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.08em] ${styles[status] || styles.pending}`}>
      {status || "pending"}
    </span>
  );
}

function CastSlider({ cast, setCast }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= cast.length) setIndex(Math.max(0, cast.length - 1));
  }, [cast.length, index]);

  useEffect(() => {
    return () => {
      cast.forEach((c) => {
        if (c.photoPreviewUrl) URL.revokeObjectURL(c.photoPreviewUrl);
      });
    };
  }, []);

  function addMember() {
    setCast((prev) => [
      ...prev,
      { clientId: crypto.randomUUID(), _id: null, name: "", characterName: "", photoFile: null, photoPreviewUrl: null, existingPhotoUrl: null },
    ]);
    setIndex(cast.length);
  }

  function updateMember(clientId, field, value) {
    setCast((prev) => prev.map((c) => (c.clientId === clientId ? { ...c, [field]: value } : c)));
  }

  function updatePhoto(clientId, file) {
    setCast((prev) =>
      prev.map((c) => {
        if (c.clientId !== clientId) return c;
        if (c.photoPreviewUrl) URL.revokeObjectURL(c.photoPreviewUrl);
        return { ...c, photoFile: file, photoPreviewUrl: file ? URL.createObjectURL(file) : null };
      })
    );
  }

  function removeMember(clientId) {
    setIndex((i) => Math.min(i, Math.max(0, cast.length - 2)));
    setCast((prev) => {
      const target = prev.find((c) => c.clientId === clientId);
      if (target?.photoPreviewUrl) URL.revokeObjectURL(target.photoPreviewUrl);
      return prev.filter((c) => c.clientId !== clientId);
    });
  }

  if (cast.length === 0) {
    return (
      <button
        type="button"
        onClick={addMember}
        className="w-full rounded-[4px] border border-dashed border-[rgba(239,231,218,0.2)] bg-[#0f0c11] py-7 text-center font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)] hover:border-[var(--gold)] hover:text-[var(--gold-soft)] transition"
      >
        + Add first cast member
      </button>
    );
  }

  const current = cast[index];

  return (
    <div className="relative rounded-[4px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] p-4">
      <div className="mb-3 flex items-center justify-between px-2">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-[var(--parchment)] disabled:opacity-20 hover:bg-[rgba(217,166,83,0.15)] transition"
        >
          ‹
        </button>
        <span className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.08em] text-[var(--mauve)]">
          Cast member {index + 1} of {cast.length}
        </span>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(cast.length - 1, i + 1))}
          disabled={index === cast.length - 1}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-[var(--parchment)] disabled:opacity-20 hover:bg-[rgba(217,166,83,0.15)] transition"
        >
          ›
        </button>
      </div>

      <button
        type="button"
        onClick={() => removeMember(current.clientId)}
        aria-label="Remove this cast member"
        className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(224,138,107,0.35)] text-sm leading-none text-[var(--error)] transition-colors hover:border-[var(--error)] hover:bg-[rgba(224,138,107,0.12)]"
      >
        ×
      </button>

      <div className="flex flex-col items-center">
        <label className="block h-24 w-24 cursor-pointer overflow-hidden rounded-full border border-[rgba(239,231,218,0.2)] bg-[var(--velvet-deep)] transition-colors hover:border-[var(--gold)]">
          {current.photoPreviewUrl || current.existingPhotoUrl ? (
            <img src={current.photoPreviewUrl || current.existingPhotoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-center text-[0.65rem] leading-none text-[var(--mauve)]">
              No photo
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => updatePhoto(current.clientId, e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="mt-3 w-full space-y-2">
          <input
            type="text"
            placeholder="Actor name"
            value={current.name}
            onChange={(e) => updateMember(current.clientId, "name", e.target.value)}
            className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#17131a] px-3 py-2 text-xs text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
          />
          <input
            type="text"
            placeholder="Character name"
            value={current.characterName}
            onChange={(e) => updateMember(current.clientId, "characterName", e.target.value)}
            className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#17131a] px-3 py-2 text-xs text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={addMember}
        className="mt-3 w-full rounded-[3px] border border-dashed border-[rgba(239,231,218,0.2)] py-1.5 font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.06em] text-[var(--mauve)] hover:border-[var(--gold)] hover:text-[var(--gold-soft)] transition"
      >
        + Add another cast member
      </button>
    </div>
  );
}

export default function EditVideo() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [video, setVideo] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genres, setGenres] = useState([]);
  const [customGenreInput, setCustomGenreInput] = useState("");
  const [tags, setTags] = useState("");
  const [language, setLanguage] = useState("");
  const [productionCountry, setProductionCountry] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [cast, setCast] = useState([]);

  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [metaSaved, setMetaSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialSnapshotRef = useRef(null);

  const [newFilm, setNewFilm] = useState(null);
  const [newFilmPreviewUrl, setNewFilmPreviewUrl] = useState(null);
  const [reuploading, setReuploading] = useState(false);
  const [reuploadError, setReuploadError] = useState(null);
  const [reuploadPercent, setReuploadPercent] = useState(0);
  const [reuploadProcessingPercent, setReuploadProcessingPercent] = useState(0);
  const [reuploadPhase, setReuploadPhase] = useState("idle");
  const reuploadTimerRef = useRef(null);
  const bgVideoRef = useRef(null);
  const bgHlsRef = useRef(null);

  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState(null);

  useEffect(() => {
    if (newFilmPreviewUrl || !video?.hlsManifestUrl || !bgVideoRef.current) return;

    const el = bgVideoRef.current;
    const src = video.hlsManifestUrl;
    let hls = null;

    if (Hls.isSupported()) {
      hls = new Hls();
      bgHlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(el);
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = src;
    }

    return () => {
      if (hls) {
        hls.destroy();
        bgHlsRef.current = null;
      }
    };
  }, [video?.hlsManifestUrl, newFilmPreviewUrl]);

  useEffect(() => {
    let cancelled = false;
    getRequest(`/directors/videos/${id}`)
      .then((data) => {
        if (cancelled) return;
        setVideo(data);
        setTitle(data.title || "");
        setDescription(data.description || "");
        setGenres(data.genres || []);
        setTags((data.tags || []).join(", "));
        setLanguage(data.language || "");
        setProductionCountry(data.productionCountry || "");
        setReleaseYear(data.releaseYear || "");
        setThumbnailUrl(data.thumbnailUrl || "");

        const initialCast = (data.cast || []).map((c) => ({
          clientId: crypto.randomUUID(),
          _id: c._id,
          name: c.name || "",
          characterName: c.characterName || "",
          photoFile: null,
          photoPreviewUrl: null,
          existingPhotoUrl: c.photoUrl || null,
        }));
        setCast(initialCast);

        initialSnapshotRef.current = JSON.stringify({
          title: data.title || "",
          description: data.description || "",
          genres: data.genres || [],
          tags: (data.tags || []).join(", "),
          language: data.language || "",
          productionCountry: data.productionCountry || "",
          releaseYear: data.releaseYear || "",
          thumbnailUrl: data.thumbnailUrl || "",
          cast: initialCast.map((c) => ({ name: c.name, characterName: c.characterName })),
        });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "Failed to load video");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!initialSnapshotRef.current) return;
    const current = JSON.stringify({
      title, description, genres, tags, language, productionCountry, releaseYear, thumbnailUrl,
      cast: cast.map((c) => ({ name: c.name, characterName: c.characterName })),
    });
    setIsDirty(current !== initialSnapshotRef.current || cast.some((c) => c.photoFile));
  }, [title, description, genres, tags, language, productionCountry, releaseYear, thumbnailUrl, cast]);

  useEffect(() => {
    function handleBeforeUnload(e) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (reuploadPhase !== "processing") {
      clearInterval(reuploadTimerRef.current);
      return;
    }
    reuploadTimerRef.current = setInterval(() => {
      setReuploadProcessingPercent((p) => (p < 92 ? p + 1 : p));
    }, 2000);
    return () => clearInterval(reuploadTimerRef.current);
  }, [reuploadPhase]);

  useEffect(() => {
    return () => {
      if (newFilmPreviewUrl) URL.revokeObjectURL(newFilmPreviewUrl);
    };
  }, [newFilmPreviewUrl]);

  const customGenres = genres.filter((g) => !GENRE_OPTIONS.includes(g));
  const allGenreOptions = [...customGenres];

  function toggleGenre(g) {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  function addCustomGenre() {
    const trimmed = customGenreInput.trim();
    if (!trimmed) return;
    if (!genres.some((g) => g.toLowerCase() === trimmed.toLowerCase())) {
      setGenres((prev) => [...prev, trimmed]);
    }
    setCustomGenreInput("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMetaError(null);
    setReuploadError(null);
    setMetaSaved(false);

    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("genres", genres.join(","));
    fd.append("tags", tags);
    fd.append("language", language);
    fd.append("productionCountry", productionCountry);
    fd.append("thumbnailUrl", thumbnailUrl);
    if (releaseYear) fd.append("releaseYear", releaseYear);
    fd.append(
      "cast",
      JSON.stringify(cast.map((c) => ({ ...(c._id ? { _id: c._id } : {}), clientId: c.clientId, name: c.name, characterName: c.characterName })))
    );
    cast.forEach((c) => {
      if (c.photoFile) fd.append(`cast_photo_${c.clientId}`, c.photoFile);
    });

    setSavingMeta(true);
    try {
      await putForm(`/directors/videos/${id}`, fd);
      initialSnapshotRef.current = JSON.stringify({
        title, description, genres, tags, language, productionCountry, releaseYear, thumbnailUrl,
        cast: cast.map((c) => ({ name: c.name, characterName: c.characterName })),
      });
      setIsDirty(false);
    } catch (err) {
      setMetaError(err.message || "Failed to save changes");
      setSavingMeta(false);
      return;
    }
    setSavingMeta(false);

    if (!newFilm) {
      setMetaSaved(true);
      return;
    }

    const filmFd = new FormData();
    filmFd.append("film", newFilm);

    setReuploading(true);
    setReuploadPhase("uploading");
    setReuploadPercent(0);
    setReuploadProcessingPercent(0);
    try {
      await postForm(`/directors/videos/${id}/reupload`, filmFd, (pct) => {
        setReuploadPercent(pct);
        if (pct >= 100) setReuploadPhase("processing");
      });
      navigate(`/director/videos/${id}/watch`);
    } catch (err) {
      setReuploadError(err.message || "Reupload failed");
      setReuploading(false);
      setReuploadPhase("idle");
    }
  }

  async function handleResubmit() {
    setResubmitError(null);
    setResubmitting(true);
    try {
      await postEmpty(`/directors/videos/${id}/resubmit`);
      setVideo((prev) => ({ ...prev, moderationStatus: "pending" }));
    } catch (err) {
      setResubmitError(err.message || "Resubmit failed");
    } finally {
      setResubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[var(--stage)] text-[var(--parchment)]">
        <DirectorNav confirmBeforeLeave={false} />
        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="rounded-[4px] border border-[rgba(224,138,107,0.4)] bg-[rgba(224,138,107,0.12)] px-4 py-3 text-sm text-[var(--error)]">
            {loadError}
          </div>
        </main>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-[var(--stage)] text-[var(--parchment)]">
        <DirectorNav confirmBeforeLeave={false} />
        <main className="mx-auto max-w-6xl px-6 py-12">
          <p className="font-[var(--font-mono)] text-sm text-[var(--mauve)]">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--stage)] text-[var(--parchment)]">
      <DirectorNav confirmBeforeLeave={isDirty} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {metaError && (
          <div className="mb-4 rounded-[4px] border border-[rgba(224,138,107,0.4)] bg-[rgba(224,138,107,0.12)] px-4 py-3 text-sm text-[var(--error)]">
            {metaError}
          </div>
        )}
        {metaSaved && (
          <div className="mb-4 rounded-[4px] border border-[var(--gold)] bg-[rgba(217,166,83,0.08)] px-4 py-3 text-sm text-[var(--gold-soft)]">
            Changes saved successfully.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Top Full Width: Film Title */}
          <div className="rounded-[4px] border border-[rgba(239,231,218,0.12)] bg-[rgba(15,12,17,0.72)] p-4 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-3">
              <span className="h-px flex-1 bg-[rgba(217,166,83,0.18)]" />
              <label className="font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.18em] text-[var(--gold)]">
                Film Title
              </label>
              <span className="h-px flex-1 bg-[rgba(217,166,83,0.18)]" />
            </div>

            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your film a name"
              className="w-full h-9 rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-4 text-sm text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.45)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>

          {/* 3 Columns Section (Left, Center, Right) */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            {/* LEFT COLUMN (Description, Tags, Thumbnail URL, Language) */}
            <div className="space-y-4 lg:col-span-3">
              {/* Description */}
              <div>
                <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                  Description
                </label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] p-3 text-xs leading-relaxed text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                  Tags <span className="normal-case">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="noir, single-take, festival-cut"
                  className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2 text-xs text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
                />
              </div>

              {/* Thumbnail URL */}
              <div>
                <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                  Thumbnail URL
                </label>
                <input
                  type="text"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2 text-xs text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
                />
              </div>

              {/* Language */}
              <div>
                <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                  Language
                </label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="Enter language"
                  className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2 text-xs text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
                />
              </div>
            </div>

            {/* CENTER COLUMN (Film Stage, Cast, Action Button) */}
            <div className="space-y-4 lg:col-span-6">
              {/* Film Stage */}
              <div className="relative flex flex-col">
                {/* Orbital Backlight rings */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(217,166,83,0.035)] blur-3xl" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(217,166,83,0.06)]" />

                <div className="relative flex flex-1 flex-col">
                  <div className="mb-2 flex items-center justify-center gap-2">
                    <Film size={13} strokeWidth={1.5} className="text-[var(--gold)]" />
                    <label className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.16em] text-[var(--mauve)]">
                      Film
                    </label>
                  </div>

                  {!newFilmPreviewUrl && (
                    <label className="group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[6px] border border-[rgba(239,231,218,0.2)] bg-black text-center transition-all duration-300 hover:border-[rgba(217,166,83,0.55)]">
                      <video
                        ref={bgVideoRef}
                        muted
                        loop
                        autoPlay
                        playsInline
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 transition-colors group-hover:bg-black/70" />

                      <div className="relative z-10 p-4">
                        <h2 className="mb-1 font-[var(--font-display)] text-lg font-medium text-[var(--parchment)] drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
                          {video.title}
                        </h2>
                        <div className="mb-3 flex justify-center">
                          <StatusBadge status={video.moderationStatus} />
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-[3px] border border-[rgba(239,231,218,0.2)] bg-[#17131a] px-3.5 py-1.5 font-[var(--font-mono)] text-[0.65rem] uppercase tracking-wider text-[var(--parchment)] transition-colors group-hover:border-[var(--gold)] group-hover:text-[var(--gold-soft)]">
                          <RefreshCw size={12} strokeWidth={1.5} />
                          Replace video file
                        </span>
                      </div>

                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setNewFilm(f);
                          setNewFilmPreviewUrl(f ? URL.createObjectURL(f) : null);
                        }}
                      />
                    </label>
                  )}

                  {newFilmPreviewUrl && (
                    <div className="relative overflow-hidden rounded-[4px] border border-[rgba(239,231,218,0.16)] bg-black">
                      <video
                        src={newFilmPreviewUrl}
                        muted
                        playsInline
                        className="aspect-video w-full object-contain"
                        onLoadedData={(e) => {
                          e.currentTarget.currentTime = 1;
                        }}
                      />

                      {!reuploading && (
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/80 p-3">
                          <span className="font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.06em] text-[var(--gold-soft)]">
                            Replacement Queued
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (newFilmPreviewUrl) URL.revokeObjectURL(newFilmPreviewUrl);
                              setNewFilm(null);
                              setNewFilmPreviewUrl(null);
                            }}
                            className="rounded-[3px] border border-white/20 px-3 py-1 text-xs text-[var(--parchment)] hover:border-[var(--gold)]"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {reuploading && (
                        <div className="absolute inset-0 flex flex-col justify-end bg-black/75 p-4">
                          <div className="mb-1.5 flex justify-between font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.06em] text-[var(--parchment)]">
                            <span>{reuploadPhase === "uploading" ? "Uploading" : "Processing (estimated)"}</span>
                            <span>{reuploadPhase === "uploading" ? `${reuploadPercent}%` : `${reuploadProcessingPercent}%`}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                            <div
                              className="h-full rounded-full bg-[var(--gold)] transition-all duration-300"
                              style={{ width: `${reuploadPhase === "uploading" ? reuploadPercent : reuploadProcessingPercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {reuploadError && <p className="mt-2 text-xs text-[var(--error)]">{reuploadError}</p>}
                </div>
              </div>

              {/* Cast Section */}
              <div>
                <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                  Cast
                </label>
                <CastSlider cast={cast} setCast={setCast} />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={savingMeta || reuploading}
                className="w-full rounded-[4px] bg-[var(--gold)] py-3 font-[var(--font-body)] text-sm font-semibold uppercase tracking-wider text-[#100d10] transition-colors hover:bg-[var(--gold-soft)] hover:brightness-105 disabled:opacity-60 shadow-lg shadow-[#d9a653]/15"
              >
                {savingMeta ? "Saving Changes…" : reuploading ? "Uploading Film…" : "Save Changes"}
              </button>
            </div>

            {/* RIGHT COLUMN (Genres, Moderation Card, Country & Year) */}
            <div className="space-y-4 lg:col-span-3">
              {/* Genres */}
              <div>
                <label className="mb-2 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                  Genres
                </label>
                <div className="mb-3 flex flex-wrap gap-2">
                  {allGenreOptions.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenre(g)}
                      aria-pressed={genres.includes(g)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        genres.includes(g)
                          ? "border-[var(--gold)] bg-[rgba(217,166,83,0.08)] text-[var(--gold-soft)]"
                          : "border-[rgba(239,231,218,0.2)] text-[var(--mauve)] hover:border-[var(--gold)]"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customGenreInput}
                    onChange={(e) => setCustomGenreInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomGenre();
                      }
                    }}
                    placeholder="Add a genre not listed above"
                    className="flex-1 rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2 text-xs text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addCustomGenre}
                    className="rounded-[3px] border border-[rgba(239,231,218,0.16)] px-3 text-xs text-[var(--parchment)] hover:border-[var(--gold)] transition"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Moderation Card */}
              <div className="flex flex-col justify-between rounded-[4px] border border-[rgba(239,231,218,0.16)] bg-[rgba(15,12,17,0.55)] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={video.moderationStatus} />
                    <p className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.14em] text-[var(--gold)]">
                      Moderation
                    </p>
                  </div>
                  <StatusBadge status={video.moderationStatus} />
                </div>

                <p className="mt-3 text-xs leading-relaxed text-[var(--mauve)]">
                  {video.moderationStatus === "approved" && "This film is live and publicly visible to all viewers."}
                  {video.moderationStatus === "pending" && "Awaiting moderator review before publishing."}
                  {video.moderationStatus === "rejected" && (video.moderationComment || "This film was rejected. Address notes and resubmit.")}
                </p>

                {video.moderationStatus === "rejected" && (
                  <>
                    <button
                      type="button"
                      onClick={handleResubmit}
                      disabled={resubmitting}
                      className="mt-3.5 w-full rounded-[3px] border border-[rgba(217,166,83,0.4)] bg-[rgba(217,166,83,0.05)] py-2 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.06em] text-[var(--gold-soft)] hover:bg-[rgba(217,166,83,0.12)] disabled:opacity-50 transition"
                    >
                      {resubmitting ? "Resubmitting…" : "Resubmit for review"}
                    </button>
                    {resubmitError && <p className="mt-2 text-xs text-[var(--error)]">{resubmitError}</p>}
                  </>
                )}
              </div>

              {/* Country & Release Year (Side-by-side) */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1.5 block whitespace-nowrap font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                    Country
                  </label>
                  <input
                    type="text"
                    value={productionCountry}
                    onChange={(e) => setProductionCountry(e.target.value)}
                    className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2 text-xs text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block whitespace-nowrap font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                    Release Year
                  </label>
                  <input
                    type="number"
                    value={releaseYear}
                    onChange={(e) => setReleaseYear(e.target.value)}
                    className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2 text-xs text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}