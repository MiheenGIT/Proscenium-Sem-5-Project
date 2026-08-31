import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DirectorNav from "../../components/DirectorNav.jsx";
import { postForm } from "../../api/client";
import {
  Upload,
  Film,
  Sparkles,
  Type,
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
    id: crypto.randomUUID(), // doubles as clientId sent to backend
    name: "",
    characterName: "",
    photoFile: null,
    photoPreviewUrl: null,
  };
}

// ---------- cast slider ----------

function CastSlider({ cast, setCast }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // keep index in range as members are added/removed
    if (index >= cast.length) setIndex(Math.max(0, cast.length - 1));
  }, [cast.length, index]);

  useEffect(() => {
    return () => {
      cast.forEach((c) => {
        if (c.photoPreviewUrl) URL.revokeObjectURL(c.photoPreviewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addMember() {
    setCast((prev) => [...prev, emptyCastMember()]);
    setIndex(cast.length); // jump to the new one
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
        className="w-full rounded-[3px] mt-1 border border-dashed border-[rgba(239,231,218,0.25)] py-8 text-center font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.08em] text-[var(--mauve)] hover:border-[var(--gold)] hover:text-[var(--gold-soft)]"
      >
        + Add first cast member
      </button>
    );
  }

  const current = cast[index];

  return (
    <div className="relative rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex h-8 w-8 ml-30 items-center justify-center rounded-full text-[var(--parchment)] disabled:opacity-30 hover:bg-[rgba(217,166,83,0.15)]"
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
          className="flex h-8 w-8 mr-30 items-center justify-center rounded-full text-[var(--parchment)] disabled:opacity-30 hover:bg-[rgba(217,166,83,0.15)]"
        >
          ›
        </button>
      </div>

      <button
        type="button"
        onClick={() => removeMember(current.id)}
        aria-label="Remove this cast member"
        title="Remove this cast member"
        className="absolute right-5 top-14 flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(224,138,107,0.35)] text-base leading-none text-[var(--error)] transition-colors hover:border-[var(--error)] hover:bg-[rgba(224,138,107,0.12)]"
      >
        ×
      </button>

      <div className="flex flex-col items-center">
        <label className="block h-28 w-28 cursor-pointer overflow-hidden rounded-full border border-[rgba(239,231,218,0.2)] bg-[var(--velvet-deep)] transition-colors hover:border-[var(--gold)]">
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

        <div className="mt-4 w-full max-w-xl space-y-2">
          <input
            type="text"
            placeholder="Actor name"
            value={current.name}
            onChange={(e) => updateMember(current.id, "name", e.target.value)}
            className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#17131a] px-3 py-2 text-sm text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
          />
          <input
            type="text"
            placeholder="Character name"
            value={current.characterName}
            onChange={(e) =>
              updateMember(current.id, "characterName", e.target.value)
            }
            className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#17131a] px-3 py-2 text-sm text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={addMember}
        className="mt-4 w-full rounded-[3px] border border-dashed border-[rgba(239,231,218,0.2)] py-2 font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.06em] text-[var(--mauve)] hover:border-[var(--gold)] hover:text-[var(--gold-soft)]"
      >
        + Add another cast member
      </button>
    </div>
  );
}

// ---------- main page ----------

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
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [film, setFilm] = useState(null);
  const [filmPreviewUrl, setFilmPreviewUrl] = useState(null);
  const [useUpscale, setUseUpscale] = useState(true);
  const [cast, setCast] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [processingPercent, setProcessingPercent] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | uploading | processing

  const processingTimerRef = useRef(null);
  const mainRef = useRef(null);
  const castSectionRef = useRef(null);
  const prevCastLenRef = useRef(0);

  useEffect(() => {
    return () => {
      if (filmPreviewUrl) URL.revokeObjectURL(filmPreviewUrl);
    };
  }, [filmPreviewUrl]);

  // scroll just past the nav bar on first entering this page
  useEffect(() => {
    if (mainRef.current) {
      const top = mainRef.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  // scroll further down once the cast panel actually opens (0 -> 1+),
  // so the newly revealed fields are visible without a manual scroll
  useEffect(() => {
    if (
      prevCastLenRef.current === 0 &&
      cast.length > 0 &&
      castSectionRef.current
    ) {
      castSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
    prevCastLenRef.current = cast.length;
  }, [cast.length]);

  // time-based processing estimate — there's no real backend signal for
  // this phase (the endpoint runs AI upscale + full HLS ladder
  // synchronously with no progress reporting), so this ticks up over
  // roughly the time a typical short clip takes and holds just short of
  // 100% until the actual response arrives, rather than showing a bar
  // that visibly never moves at all.
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
    fd.append("thumbnailUrl", thumbnailUrl);
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
    <div className="min-h-[92vh] bg-[var(--stage)] text-[var(--parchment)]">
      <DirectorNav />

      <main ref={mainRef} className="mx-auto max-w-6xl px-8 py-12">
        {error && (
          <div className="mb-6 rounded-[3px] border border-[rgba(224,138,107,0.4)] bg-[rgba(224,138,107,0.12)] px-4 py-3 text-sm text-[var(--error)]">
            {error}
          </div>
        )}

        <motion.form
          onSubmit={handleSubmit}
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.06,
              },
            },
          }}
          className="upload-orbit-grid -mt-8 -mb-20"
        >
          {/* film file */}
          <motion.div
            variants={{
              hidden: { opacity: 0, scale: 0.92, y: 20 },
              visible: {
                opacity: 1,
                scale: 1,
                y: 0,
                transition: {
                  type: "spring",
                  stiffness: 90,
                  damping: 18,
                },
              },
            }}
            className="relative flex h-full min-h-[300px] flex-col"
          >
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(217,166,83,0.035)] blur-3xl" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(217,166,83,0.06)]" />

            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 45,
                repeat: Infinity,
                ease: "linear",
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[rgba(217,166,83,0.045)]"
            />
            <div className="relative flex h-full flex-1 flex-col">
              <div className="mb-3 flex items-center justify-center gap-2">
                <Film
                  size={13}
                  strokeWidth={1.5}
                  className="text-[var(--gold)]"
                />

                <label className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.16em] text-[var(--mauve)]">
                  Film
                </label>
              </div>

              {!filmPreviewUrl && (
                <label className="group relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[6px] border border-[rgba(239,231,218,0.2)] bg-[#0f0c11] px-8 py-10 text-center shadow-[0_0_80px_rgba(217,166,83,0.025)] transition-all duration-500 hover:border-[rgba(217,166,83,0.55)] hover:shadow-[0_0_100px_rgba(217,166,83,0.08)]">
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(217,166,83,0.3)] bg-[rgba(217,166,83,0.045)] text-[var(--gold)] shadow-[0_0_40px_rgba(217,166,83,0.06)] transition-all duration-500 group-hover:scale-105 group-hover:border-[rgba(217,166,83,0.65)] group-hover:bg-[rgba(217,166,83,0.08)]">
                    <Upload
                      size={28}
                      strokeWidth={1.3}
                      className="transition-transform duration-500 group-hover:-translate-y-1"
                    />
                  </div>

                  <span className="font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.12em] text-[var(--parchment)]">
                    Select your film
                  </span>

                  <span className="mt-1 text-xs text-[var(--mauve)]">
                    MP4, MOV, WebM or another video file
                  </span>

                  <span className="mt-4 rounded-[3px] border border-[rgba(239,231,218,0.2)] bg-[#17131a] px-4 py-2 text-xs font-medium text-[var(--parchment)] transition-colors group-hover:border-[var(--gold)] group-hover:text-[var(--gold-soft)]">
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
                <label className="group relative mt-3 block cursor-pointer overflow-hidden rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-black">
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
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[rgba(16,13,16,0)] opacity-0 transition-all group-hover:bg-[rgba(16,13,16,0.45)] group-hover:opacity-100">
                      <span className="rounded-[3px] px-4 py-2 font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.08em] text-[var(--parchment)]">
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
                    <div className="absolute inset-0 flex flex-col justify-end bg-[rgba(16,13,16,0.55)] p-4">
                      {phase === "uploading" && (
                        <>
                          <div className="mb-1.5 flex justify-between font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.06em] text-[var(--parchment)]">
                            <span>Uploading</span>
                            <span>{uploadPercent}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(239,231,218,0.25)]">
                            <div
                              className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-150 ease-out"
                              style={{ width: `${uploadPercent}%` }}
                            />
                          </div>
                        </>
                      )}

                      {phase === "processing" && (
                        <>
                          <div className="mb-1.5 flex justify-between font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.06em] text-[var(--parchment)]">
                            <span>Processing (estimated)</span>
                            <span>{processingPercent}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(239,231,218,0.25)]">
                            <div
                              className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-500 ease-out"
                              style={{ width: `${processingPercent}%` }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </label>
              )}
            </div>
          </motion.div>

          {/* AI upscale toggle */}
          <label className="flex cursor-pointer select-none flex-col justify-between rounded-[4px] border border-[rgba(239,231,218,0.16)] bg-[rgba(15,12,17,0.55)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles
                  size={13}
                  strokeWidth={1.5}
                  className="text-[var(--gold)]"
                />
                <p className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.14em] text-[var(--gold)]">
                  AI quality upscaling
                </p>
              </div>
              <div className="relative h-6 w-11 shrink-0">
                <input
                  type="checkbox"
                  checked={useUpscale}
                  onChange={() => setUseUpscale((v) => !v)}
                  className="peer sr-only"
                />
                <div className="absolute inset-0 rounded-full bg-[rgba(239,231,218,0.2)] transition-colors peer-checked:bg-[var(--gold)]" />
                <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[#1a1210] transition-transform peer-checked:translate-x-5" />
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[var(--mauve)]">
              If your footage is below 1080p, AI upscaling fills out the higher
              quality options. Leave off to only generate renditions at or below
              your upload's actual resolution.
            </p>
          </label>

          {/* title */}
          <motion.div
            variants={{
              hidden: { opacity: 0, x: -18 },
              visible: { opacity: 1, x: 0 },
            }}
            className="group h-30 relative rounded-[4px] border border-[rgba(239,231,218,0.12)] bg-[rgba(15,12,17,0.72)] p-4 backdrop-blur-sm transition-colors hover:border-[rgba(217,166,83,0.35)]"
          >
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
              className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-4 py-3 text-base text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.45)] transition-all duration-300 focus:border-[var(--gold)] focus:bg-[rgba(217,166,83,0.025)] focus:outline-none focus:ring-1 focus:ring-[rgba(217,166,83,0.15)]"
            />
          </motion.div>

          {/* description */}
          <div>
            <label className="-mt-15 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
              Description
            </label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>

          {/* genres */}
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
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
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
                className="flex-1 rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2 text-sm text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
              />
              <button
                type="button"
                onClick={addCustomGenre}
                className="rounded-[3px] border border-[rgba(239,231,218,0.16)] px-4 text-sm text-[var(--parchment)] hover:border-[var(--gold)]"
              >
                Add
              </button>
            </div>
          </div>

          {/* tags */}
          <div>
            <label className="-mt-34 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
              Tags{" "}
              <span className="normal-case text-[var(--mauve)]">
                (comma-separated)
              </span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="noir, single-take, festival-cut"
              className="w-full rounded-[3px] border mt-1 border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>

          {/* language / country / year row */}
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 no-wrap whitespace-nowrap block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                Production Country
              </label>
              <input
                type="text"
                value={productionCountry}
                onChange={(e) => setProductionCountry(e.target.value)}
                className="w-35 rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 ml-19 block whitespace-nowrap font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                Release Year
              </label>
              <input
                type="number"
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value)}
                className="w-25 rounded-[3px] ml-19 border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
              />
            </div>
          </div>

          {/* thumbnail url */}
          <div>
            <label className="-mt-36 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
              Thumbnail URL
            </label>
            <input
              type="text"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-[3px] mt-1 border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>

          <div className="-ml-71 -mt-18 grid grid-cols-1 gap-1 sm:grid-cols-3">
            <div>
                           {" "}
              <label className="mb-1.5 ml-0.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                                Language              {" "}
              </label>
                           {" "}
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-60.5 rounded-[3px] ml-0.5 border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
              />
                         {" "}
            </div>
          </div>

          {/* cast */}
          <div ref={castSectionRef} className="relative z-10">
            <label
              className={`${film ? "-mt-43" : "-mt-50"} block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]`}
            >
              Cast
            </label>
            <CastSlider cast={cast} setCast={setCast} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={cast.length > 0 ? "cast-open" : "cast-closed"}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 16 }}
              className="relative z-10"
            >
              <button
                type="submit"
                disabled={submitting}
                className={`flex h-10 max-w-[420px] items-center justify-center rounded-[3px] bg-[var(--gold)] py-3 font-[var(--font-body)] text-sm font-semibold leading-none text-[#1a1210] transition-[margin,width,background-color] duration-500 ease-in-out hover:bg-[var(--gold-soft)] disabled:cursor-not-allowed disabled:opacity-60 ${
                  cast.length > 0
                    ? `ml-143 w-60`
                    : "mx-auto w-full -mt-17"
                }`}
              >
                {submitting ? "Working…" : "Upload Film"}
              </button>
            </motion.div>
          </AnimatePresence>
        </motion.form>

        <style>{`
          .upload-orbit-grid {
            position: relative;
            display: grid;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            column-gap: 2.5rem;
            row-gap: 1.1rem;
            padding: 1.25rem 0 1rem;
          }
 
          .upload-orbit-grid > * {
            min-width: 0;
          }
 
          .upload-orbit-grid > :nth-child(1) {
            grid-column: 4 / span 6;
            grid-row: 1 / span 3;
          }
 
          .upload-orbit-grid > :nth-child(2) {
            grid-column: 10 / span 3;
            grid-row: 2;
          }
 
          .upload-orbit-grid > :nth-child(3) {
            grid-column: 1 / span 3;
            grid-row: 1;
          }
 
          .upload-orbit-grid > :nth-child(4) {
            grid-column: 1 / span 3;
            grid-row: 2;
          }
 
          .upload-orbit-grid > :nth-child(5) {
            grid-column: 10 / span 3;
            grid-row: 1;
          }
 
          .upload-orbit-grid > :nth-child(6) {
            grid-column: 1 / span 3;
            grid-row: 3;
          }
 
          .upload-orbit-grid > :nth-child(7) {
            grid-column: 10 / span 3;
            grid-row: 3;
          }
 
          .upload-orbit-grid > :nth-child(8) {
            grid-column: 1 / span 3;
            grid-row: 4;
          }
 
          .upload-orbit-grid > :nth-child(9) {
            grid-column: 4 / span 6;
            grid-row: 4 / span 2;
          }
 
          .upload-orbit-grid > :nth-child(10) {
            grid-column: 4 / span 6;
            grid-row: 6;
          }

          .upload-orbit-grid > :nth-child(11) {
            grid-column: 4 / span 6;
            grid-row: 7;
          }
 
          @media (max-width: 900px) {
            .upload-orbit-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
 
            .upload-orbit-grid > * {
              grid-column: auto !important;
              grid-row: auto !important;
            }
 
            .upload-orbit-grid > :nth-child(1) {
              grid-column: 1 / -1 !important;
              grid-row: 1 !important;
              order: -10;
            }
          }
 
          @media (max-width: 640px) {
            .upload-orbit-grid {
              display: flex;
              flex-direction: column;
              gap: 1rem;
            }
 
            .upload-orbit-grid > :nth-child(1) {
              order: -10;
            }
          }
        `}</style>
      </main>
    </div>
  );
}
