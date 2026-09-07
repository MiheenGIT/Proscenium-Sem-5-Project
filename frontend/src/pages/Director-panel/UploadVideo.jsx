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

  useEffect(() => {
    return () => {
      cast.forEach((c) => {
        if (c.photoPreviewUrl) URL.revokeObjectURL(c.photoPreviewUrl);
      });
    };
  }, []);

  function addMember() {
    setCast((prev) => [...prev, emptyCastMember()]);
    setIndex(cast.length);
  }

  function updateMember(id, field, value) {
    setCast((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  }

  function updatePhoto(id, file) {
    setCast((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.photoPreviewUrl) URL.revokeObjectURL(c.photoPreviewUrl);
        return {
          ...c,
          photoFile: file,
          photoPreviewUrl: file ? URL.createObjectURL(file) : null,
        };
      }),
    );
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
      {/* Navigation Header */}
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
        onClick={() => removeMember(current.id)}
        aria-label="Remove this cast member"
        className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(224,138,107,0.35)] text-sm leading-none text-[var(--error)] transition-colors hover:border-[var(--error)] hover:bg-[rgba(224,138,107,0.12)]"
      >
        ×
      </button>

      <div className="flex flex-col items-center">
        <label className="block h-24 w-24 cursor-pointer overflow-hidden rounded-full border border-[rgba(239,231,218,0.2)] bg-[var(--velvet-deep)] transition-colors hover:border-[var(--gold)]">
          {current.photoPreviewUrl ? (
            <img
              src={current.photoPreviewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-center text-[0.65rem] leading-none text-[var(--mauve)]">
              No photo
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) =>
              updatePhoto(current.id, e.target.files?.[0] ?? null)
            }
          />
        </label>

        <div className="mt-3 w-full space-y-2">
          <input
            type="text"
            placeholder="Actor name"
            value={current.name}
            onChange={(e) => updateMember(current.id, "name", e.target.value)}
            className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#17131a] px-3 py-2 text-xs text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
          />
          <input
            type="text"
            placeholder="Character name"
            value={current.characterName}
            onChange={(e) =>
              updateMember(current.id, "characterName", e.target.value)
            }
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
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="noir, single-take, festival-cut"
                  className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2 text-xs text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
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
                      <img
                        src={thumbnailPreviewUrl}
                        alt="Thumbnail preview"
                        className="h-[85px] w-full object-cover"
                      />
                      {!submitting && (
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
                          <label className="cursor-pointer rounded-[3px] bg-[#0f0c11]/90 px-2 py-0.5 text-[0.65rem] text-[var(--parchment)] hover:border-[var(--gold)] border border-white/10">
                            Change
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleThumbnailChange}
                              className="hidden"
                            />
                          </label>
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
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="rounded-[3px] border border-white/20 bg-[#17131a] px-4 py-2 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.08em] text-[var(--parchment)]">
                            Choose another video
                          </span>
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
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}