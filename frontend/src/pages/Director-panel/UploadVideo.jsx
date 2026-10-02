import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DirectorNav from "../../components/DirectorNav.jsx";
import { postForm } from "../../api/client";
import {
  Upload,
  Film,
  Sparkles,
  AlignLeft,
  Tags,
  Globe2,
  CalendarDays,
  Image,
  Users,
  X,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const GENRE_OPTIONS = [
  "Drama",
  "Comedy",
  "Thriller",
  "Horror",
  "Documentary",
  "Sci-Fi",
  "Romance",
];

function emptyCastMember() {
  return {
    id: crypto.randomUUID(),
    name: "",
    characterName: "",
    photoFile: null,
    photoPreviewUrl: null,
  };
}

function CastSlider({ cast, setCast }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= cast.length) setIndex(Math.max(0, cast.length - 1));
  }, [cast.length, index]);

  useEffect(() => () => {
    cast.forEach((c) => c.photoPreviewUrl && URL.revokeObjectURL(c.photoPreviewUrl));
  }, []);

  function addMember() {
    setCast((prev) => [...prev, emptyCastMember()]);
    setIndex(cast.length);
  }

  function updateMember(id, field, value) {
    setCast((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  function updatePhoto(id, file) {
    setCast((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      if (c.photoPreviewUrl) URL.revokeObjectURL(c.photoPreviewUrl);
      return { ...c, photoFile: file, photoPreviewUrl: file ? URL.createObjectURL(file) : null };
    }));
  }

  function removeMember(id) {
    setIndex((i) => Math.min(i, Math.max(0, cast.length - 2)));
    setCast((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target?.photoPreviewUrl) URL.revokeObjectURL(target.photoPreviewUrl);
      return prev.filter((c) => c.id !== id);
    });
  }

  if (cast.length === 0) {
    return (
      <button type="button" onClick={addMember}
        className="group w-full rounded-[6px] border border-dashed border-[rgba(239,231,218,0.2)] bg-[#0f0c11] px-4 py-8 text-center transition hover:border-[var(--gold)] hover:bg-[rgba(217,166,83,0.04)]">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(217,166,83,0.25)] bg-[rgba(217,166,83,0.06)] text-lg text-[var(--gold-soft)]">+</div>
        <div className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--parchment)]">Add first cast member</div>
        <div className="mt-1 text-[0.68rem] text-[var(--mauve)]">Add actor, character and profile photo</div>
      </button>
    );
  }

  const current = cast[index];
  return (
    <div className="overflow-hidden rounded-[6px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11]">
      <div className="flex items-center justify-between border-b border-[rgba(239,231,218,0.1)] bg-[#141017] px-4 py-3">
        <div>
          <div className="font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.1em] text-[var(--mauve)]">Cast &amp; Crew</div>
          <div className="mt-1 text-[0.72rem] text-[var(--parchment)]">Add actor, character and profile image.</div>
        </div>
        <span className="rounded-full border border-[rgba(217,166,83,0.2)] bg-[rgba(217,166,83,0.06)] px-2.5 py-1 font-[var(--font-mono)] text-[0.62rem] text-[var(--gold-soft)]">{index + 1} / {cast.length}</span>
      </div>

      <div className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} aria-label="Previous cast member"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-base text-[var(--parchment)] transition hover:border-[rgba(217,166,83,0.45)] hover:bg-[rgba(217,166,83,0.1)] disabled:cursor-not-allowed disabled:opacity-20">‹</button>
          <div className="flex min-w-0 flex-1 justify-center gap-1.5 overflow-hidden">
            {cast.map((member, i) => <button key={member.id} type="button" onClick={() => setIndex(i)} aria-label={`Select cast member ${i + 1}`}
              className={`h-1.5 min-w-4 max-w-8 rounded-full transition-all ${i === index ? "bg-[var(--gold)]" : "bg-white/10 hover:bg-white/20"}`} />)}
          </div>
          <button type="button" onClick={() => setIndex((i) => Math.min(cast.length - 1, i + 1))} disabled={index === cast.length - 1} aria-label="Next cast member"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-base text-[var(--parchment)] transition hover:border-[rgba(217,166,83,0.45)] hover:bg-[rgba(217,166,83,0.1)] disabled:cursor-not-allowed disabled:opacity-20">›</button>
        </div>

        <div className="relative grid gap-4 rounded-[5px] border border-[rgba(239,231,218,0.1)] bg-[#121016] p-4 sm:grid-cols-[112px_1fr]">
          <button type="button" onClick={() => removeMember(current.id)} aria-label="Remove this cast member"
            className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(224,138,107,0.3)] bg-[#121016] text-sm text-[var(--error)] transition hover:border-[var(--error)] hover:bg-[rgba(224,138,107,0.12)]">×</button>

          <label className="group mx-auto block h-28 w-28 cursor-pointer overflow-hidden rounded-[6px] border border-[rgba(239,231,218,0.16)] bg-[var(--velvet-deep)] transition hover:border-[var(--gold)] sm:mx-0">
            {current.photoPreviewUrl ? <img src={current.photoPreviewUrl} alt={current.name || "Cast member"} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> :
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center text-[var(--mauve)]"><Users size={22} strokeWidth={1.5} /><span className="text-[0.6rem] uppercase tracking-[0.06em]">Add photo</span></div>}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => updatePhoto(current.id, e.target.files?.[0] ?? null)} />
          </label>

          <div className="min-w-0 space-y-3 pr-6">
            <div><label className="mb-1.5 block font-[var(--font-mono)] text-[0.58rem] uppercase tracking-[0.08em] text-[var(--mauve)]">Actor / Artist name</label>
              <input type="text" placeholder="e.g. Tom Hanks" value={current.name} onChange={(e) => updateMember(current.id, "name", e.target.value)}
                className="w-full rounded-[4px] border border-[rgba(239,231,218,0.14)] bg-[#17131a] px-3 py-2.5 text-xs text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] transition focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[rgba(217,166,83,0.12)]" /></div>
            <div><label className="mb-1.5 block font-[var(--font-mono)] text-[0.58rem] uppercase tracking-[0.08em] text-[var(--mauve)]">Character name</label>
              <input type="text" placeholder="e.g. Mr. White" value={current.characterName} onChange={(e) => updateMember(current.id, "characterName", e.target.value)}
                className="w-full rounded-[4px] border border-[rgba(239,231,218,0.14)] bg-[#17131a] px-3 py-2.5 text-xs text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] transition focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[rgba(217,166,83,0.12)]" /></div>
          </div>
        </div>

        <button type="button" onClick={addMember}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[4px] border border-dashed border-[rgba(239,231,218,0.18)] bg-transparent py-2.5 font-[var(--font-mono)] text-[0.63rem] uppercase tracking-[0.07em] text-[var(--mauve)] transition hover:border-[var(--gold)] hover:bg-[rgba(217,166,83,0.04)] hover:text-[var(--gold-soft)]">
          <Plus size={14} /> Add another cast member
        </button>
      </div>
    </div>
  );
}

export default function UploadVideo() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genres, setGenres] = useState([]);
  const [customGenres, setCustomGenres] = useState([]);
  const [customGenreInput, setCustomGenreInput] = useState("");
  const [tags, setTags] = useState("");
  const [language, setLanguage] = useState("");
  const [productionCountry, setProductionCountry] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState(null);
  const [film, setFilm] = useState(null);
  const [filmPreviewUrl, setFilmPreviewUrl] = useState(null);
  const [useUpscale, setUseUpscale] = useState(true);
  const [cast, setCast] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [processingPercent, setProcessingPercent] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [thumbnailPreviewOpen, setThumbnailPreviewOpen] = useState(false);

  const processingTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (filmPreviewUrl) URL.revokeObjectURL(filmPreviewUrl);
    };
  }, [filmPreviewUrl]);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    };
  }, [thumbnailPreviewUrl]);

  useEffect(() => {
    if (!submitting) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "Your video is still uploading. Please do not refresh or close this page.";
      return event.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submitting]);

  useEffect(() => {
    if (phase !== "processing") {
      clearInterval(processingTimerRef.current);
      return;
    }
    processingTimerRef.current = setInterval(() => {
      setProcessingPercent((p) => (p < 92 ? p + 1 : p));
    }, 2000);
    return () => clearInterval(processingTimerRef.current);
  }, [phase]);

  const allGenreOptions = [...GENRE_OPTIONS, ...customGenres];

  function toggleGenre(g) {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }

  function addCustomGenre() {
    const trimmed = customGenreInput.trim();
    if (!trimmed) return;
    const alreadyExists = allGenreOptions.some(
      (g) => g.toLowerCase() === trimmed.toLowerCase(),
    );
    if (!alreadyExists) setCustomGenres((prev) => [...prev, trimmed]);
    setGenres((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setCustomGenreInput("");
  }

  function handleThumbnailChange(e) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Thumbnail must be JPG, PNG, or WebP.");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Thumbnail must be smaller than 10 MB.");
      e.target.value = "";
      return;
    }

    setError(null);
    if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    setThumbnailFile(file);
    setThumbnailPreviewUrl(URL.createObjectURL(file));
  }

  function removeThumbnail() {
    if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    setThumbnailFile(null);
    setThumbnailPreviewUrl(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!film) {
      setError("Select a video file to upload.");
      return;
    }

    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("film", film);
    fd.append("genres", genres.join(","));
    fd.append("tags", tags);
    fd.append("language", language);
    fd.append("productionCountry", productionCountry);
    if (thumbnailFile) fd.append("thumbnail", thumbnailFile);
    fd.append("useUpscale", useUpscale ? "true" : "false");
    if (releaseYear) fd.append("releaseYear", releaseYear);

    fd.append(
      "cast",
      JSON.stringify(
        cast.map((c) => ({
          clientId: c.id,
          name: c.name,
          characterName: c.characterName,
        })),
      ),
    );
    cast.forEach((c) => {
      if (c.photoFile) fd.append(`cast_photo_${c.id}`, c.photoFile);
    });

    setSubmitting(true);
    setPhase("uploading");
    setUploadPercent(0);
    setProcessingPercent(0);
    try {
      const data = await postForm("/directors/upload-video", fd, (pct) => {
        setUploadPercent(pct);
        if (pct >= 100) setPhase("processing");
      });
      navigate(`/director/videos/${data.video_id}/watch`);
    } catch (err) {
      setError(err.message || "Upload failed");
      setSubmitting(false);
      setPhase("idle");
    }
  }

  return (
    <div className="min-h-screen bg-[var(--stage)] text-[var(--parchment)]">
      <DirectorNav />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <div className="mb-4 rounded-[4px] border border-[rgba(224,138,107,0.4)] bg-[rgba(224,138,107,0.12)] px-4 py-3 text-sm text-[var(--error)]">
            {error}
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
            {/* LEFT COLUMN (Description, Tags, Thumbnail, Language) */}
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
                <textarea
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="noir, single-take, festival-cut"
                  rows={2}
                  className="max-h-[72px] min-h-[42px] w-full resize-none overflow-y-auto rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2 text-xs leading-relaxed text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
                />
              </div>

              {/* Thumbnail */}
              <div>
                <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                  Thumbnail
                </label>

                {!thumbnailPreviewUrl ? (
                  <label className="group flex h-[85px] w-full cursor-pointer flex-col items-center justify-center rounded-[3px] border border-dashed border-[rgba(239,231,218,0.2)] bg-[#0f0c11] px-3 text-center transition-colors hover:border-[var(--gold)]">
                    <Image size={18} strokeWidth={1.5} className="mb-1 text-[var(--gold)]" />
                    <span className="font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.08em] text-[var(--parchment)]">
                      Choose thumbnail
                    </span>
                    <span className="mt-0.5 text-[0.65rem] text-[var(--mauve)]">
                      JPG, PNG or WebP · Max 10 MB
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleThumbnailChange}
                      className="hidden"
                      disabled={submitting}
                    />
                  </label>
                ) : (
                  <div className="w-full overflow-hidden rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11]">
                    <div className="relative">
                      <div className="flex min-h-[170px] max-h-[240px] items-center justify-center bg-black p-2">
                        <img
                          src={thumbnailPreviewUrl}
                          alt="Thumbnail preview"
                          className="max-h-[220px] w-full object-contain rounded-[2px]"
                        />
                      </div>
                      {!submitting && (
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setThumbnailPreviewOpen(true)}
                              className="rounded-[3px] border border-white/10 bg-[#0f0c11]/90 px-2 py-0.5 text-[0.65rem] text-[var(--parchment)] hover:border-[var(--gold)]"
                            >
                              Preview
                            </button>
                            <label className="cursor-pointer rounded-[3px] border border-white/10 bg-[#0f0c11]/90 px-2 py-0.5 text-[0.65rem] text-[var(--parchment)] hover:border-[var(--gold)]">
                              Change
                              <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleThumbnailChange}
                              className="hidden"
                            />
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={removeThumbnail}
                            className="rounded-[3px] bg-[#0f0c11]/90 px-2 py-0.5 text-[0.65rem] text-[var(--error)] hover:border-[var(--error)] border border-white/10"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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

                  {!filmPreviewUrl && (
                    <label className="group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[6px] border border-[rgba(239,231,218,0.2)] bg-[#0f0c11] px-6 py-6 text-center transition-all duration-300 hover:border-[rgba(217,166,83,0.55)]">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(217,166,83,0.3)] bg-[rgba(217,166,83,0.045)] text-[var(--gold)] transition-transform duration-300 group-hover:scale-105">
                        <Upload size={20} strokeWidth={1.4} />
                      </div>

                      <span className="font-[var(--font-mono)] text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--parchment)]">
                        Select your film
                      </span>

                      <span className="mt-1 text-xs text-[var(--mauve)]">
                        MP4, MOV, WebM or another video file
                      </span>

                      <span className="mt-3 rounded-[3px] border border-[rgba(239,231,218,0.2)] bg-[#17131a] px-4 py-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-wider text-[var(--parchment)] transition-colors group-hover:border-[var(--gold)] group-hover:text-[var(--gold-soft)]">
                        Choose video
                      </span>

                      <input
                        type="file"
                        accept="video/*"
                        required
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          if (filmPreviewUrl) URL.revokeObjectURL(filmPreviewUrl);
                          setFilm(f);
                          setFilmPreviewUrl(f ? URL.createObjectURL(f) : null);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}

                  {filmPreviewUrl && (
                    <label className="group relative block cursor-pointer overflow-hidden rounded-[4px] border border-[rgba(239,231,218,0.16)] bg-black">
                      <video
                        src={filmPreviewUrl}
                        muted
                        playsInline
                        className="aspect-video w-full object-contain"
                        onLoadedData={(e) => {
                          e.currentTarget.currentTime = 1;
                        }}
                      />

                      {!submitting && (
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPreviewOpen(true);
                            }}
                            className="rounded-[3px] border border-white/15 bg-[#0f0c11]/95 px-3 py-1.5 font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.08em] text-[var(--parchment)] hover:border-[var(--gold)] hover:text-[var(--gold-soft)]"
                          >
                            Preview video
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (filmPreviewUrl) URL.revokeObjectURL(filmPreviewUrl);
                              setFilm(null);
                              setFilmPreviewUrl(null);
                            }}
                            className="rounded-[3px] border border-[rgba(224,138,107,0.35)] bg-[#0f0c11]/95 px-3 py-1.5 font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.08em] text-[var(--error)] hover:border-[var(--error)]"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          if (filmPreviewUrl) URL.revokeObjectURL(filmPreviewUrl);
                          setFilm(f);
                          setFilmPreviewUrl(f ? URL.createObjectURL(f) : null);
                        }}
                        className="hidden"
                      />

                      {submitting && (
                        <div className="absolute inset-0 flex flex-col justify-end bg-black/70 p-4">
                          <div className="mb-1.5 flex justify-between font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.06em] text-[var(--parchment)]">
                            <span>{phase === "uploading" ? "Uploading" : "Processing (estimated)"}</span>
                            <span>{phase === "uploading" ? `${uploadPercent}%` : `${processingPercent}%`}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                            <div
                              className="h-full rounded-full bg-[var(--gold)] transition-all duration-300"
                              style={{ width: `${phase === "uploading" ? uploadPercent : processingPercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </label>
                  )}
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
                disabled={submitting}
                className="w-full rounded-[4px] bg-[var(--gold)] py-3 font-[var(--font-body)] text-sm font-semibold uppercase tracking-wider text-[#100d10] transition-colors hover:bg-[var(--gold-soft)] hover:brightness-105 disabled:opacity-60 shadow-lg shadow-[#d9a653]/15"
              >
                {submitting ? "Uploading Film…" : "Upload Film"}
              </button>
            </div>

            {/* RIGHT COLUMN (Genres, AI Upscale, Country & Year) */}
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

              {/* AI Quality Upscale */}
              <label className="flex cursor-pointer select-none flex-col justify-between rounded-[4px] border border-[rgba(239,231,218,0.16)] bg-[rgba(15,12,17,0.55)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} strokeWidth={1.5} className="text-[var(--gold)]" />
                    <p className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.14em] text-[var(--gold)]">
                      AI quality upscaling
                    </p>
                  </div>
                  <div className="relative h-5 w-10 shrink-0">
                    <input
                      type="checkbox"
                      checked={useUpscale}
                      onChange={() => setUseUpscale((v) => !v)}
                      className="peer sr-only"
                    />
                    <div className="absolute inset-0 rounded-full bg-[rgba(239,231,218,0.2)] transition-colors peer-checked:bg-[var(--gold)]" />
                    <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[#1a1210] transition-transform peer-checked:translate-x-5" />
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-[var(--mauve)]">
                  If your footage is below 1080p, AI upscaling fills out the higher quality options. Leave off to only generate renditions at or below your upload's actual resolution.
                </p>
              </label>

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

              {/* Language */}
              <div>
                <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                  Language
                </label>
                <textarea
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="Enter language"
                  rows={2}
                  className="max-h-[72px] min-h-[42px] w-full resize-none overflow-y-auto rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2 text-xs leading-relaxed text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </form>

        {previewOpen && filmPreviewUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={() => setPreviewOpen(false)}>
            <div className="w-full max-w-5xl rounded-[6px] border border-white/10 bg-[#0f0c11] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.14em] text-[var(--gold)]">Video Preview</p>
                  <p className="mt-1 text-xs text-[var(--mauve)]">{film?.name}</p>
                </div>
                <button type="button" onClick={() => setPreviewOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[var(--parchment)] hover:border-[var(--gold)]" aria-label="Close preview">×</button>
              </div>
              <video src={filmPreviewUrl} controls autoPlay playsInline className="max-h-[70vh] w-full rounded-[4px] bg-black object-contain" />
            </div>
          </div>
        )}

        {thumbnailPreviewOpen && thumbnailPreviewUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={() => setThumbnailPreviewOpen(false)}>
            <div className="w-full max-w-4xl rounded-[6px] border border-white/10 bg-[#0f0c11] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.14em] text-[var(--gold)]">Thumbnail Preview</p>
                <button type="button" onClick={() => setThumbnailPreviewOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[var(--parchment)] hover:border-[var(--gold)]" aria-label="Close thumbnail preview">×</button>
              </div>
              <div className="flex max-h-[75vh] items-center justify-center rounded-[4px] bg-black p-3">
                <img src={thumbnailPreviewUrl} alt="Full thumbnail preview" className="max-h-[70vh] max-w-full object-contain" />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}