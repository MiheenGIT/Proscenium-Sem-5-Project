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
  Type,
  AlignLeft,
  Tags as TagsIcon,
  Globe2,
  CalendarDays,
  Image as ImageIcon,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";

const GENRE_OPTIONS = [
  "Drama", "Comedy", "Thriller", "Horror", "Documentary",
  "Sci-Fi", "Romance", "Animation", "Action", "Experimental",
];

function StatusIcon({ status }) {
  if (status === "approved") return <ShieldCheck size={13} strokeWidth={1.5} className="text-[var(--gold)]" />;
  if (status === "rejected") return <ShieldAlert size={13} strokeWidth={1.5} className="text-[var(--error)]" />;
  return <ShieldQuestion size={13} strokeWidth={1.5} className="text-[var(--gold)]" />;
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

// ---------- cast slider (same visual pattern as UploadVideo's) ----------

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        className="mt-1 w-full rounded-[3px] border border-dashed border-[rgba(239,231,218,0.25)] py-8 text-center font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.08em] text-[var(--mauve)] hover:border-[var(--gold)] hover:text-[var(--gold-soft)]"
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
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--parchment)] disabled:opacity-30 hover:bg-[rgba(217,166,83,0.15)]"
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
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--parchment)] disabled:opacity-30 hover:bg-[rgba(217,166,83,0.15)]"
        >
          ›
        </button>
      </div>

      <button
        type="button"
        onClick={() => removeMember(current.id)}
        aria-label="Remove this cast member"
        onClickCapture={() => removeMember(current.clientId)}
        className="absolute right-5 top-14 flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(224,138,107,0.35)] text-base leading-none text-[var(--error)] transition-colors hover:border-[var(--error)] hover:bg-[rgba(224,138,107,0.12)]"
      >
        ×
      </button>

      <div className="flex flex-col items-center">
        <label className="block h-28 w-28 cursor-pointer overflow-hidden rounded-full border border-[rgba(239,231,218,0.2)] bg-[var(--velvet-deep)] transition-colors hover:border-[var(--gold)]">
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

        <div className="mt-4 w-full max-w-xl space-y-2">
          <input
            type="text"
            placeholder="Actor name"
            value={current.name}
            onChange={(e) => updateMember(current.clientId, "name", e.target.value)}
            className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#17131a] px-3 py-2 text-sm text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
          />
          <input
            type="text"
            placeholder="Character name"
            value={current.characterName}
            onChange={(e) => updateMember(current.clientId, "characterName", e.target.value)}
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

  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState(null);

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

  async function handleMetaSubmit(e) {
    e.preventDefault();
    setMetaError(null);
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
      setMetaSaved(true);
      initialSnapshotRef.current = JSON.stringify({
        title, description, genres, tags, language, productionCountry, releaseYear, thumbnailUrl,
        cast: cast.map((c) => ({ name: c.name, characterName: c.characterName })),
      });
      setIsDirty(false);
    } catch (err) {
      setMetaError(err.message || "Failed to save changes");
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleReupload() {
    setReuploadError(null);
    if (!newFilm) return;
    const fd = new FormData();
    fd.append("film", newFilm);

    setReuploading(true);
    setReuploadPhase("uploading");
    setReuploadPercent(0);
    setReuploadProcessingPercent(0);
    try {
      await postForm(`/directors/videos/${id}/reupload`, fd, (pct) => {
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
      <div className="min-h-[92vh] bg-[var(--stage)] text-[var(--parchment)]">
        <DirectorNav confirmBeforeLeave={false} />
        <main className="mx-auto max-w-6xl px-8 py-12">
          <div className="rounded-[3px] border border-[rgba(224,138,107,0.4)] bg-[rgba(224,138,107,0.12)] px-4 py-3 text-sm text-[var(--error)]">
            {loadError}
          </div>
        </main>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-[92vh] bg-[var(--stage)] text-[var(--parchment)]">
        <DirectorNav confirmBeforeLeave={false} />
        <main className="mx-auto max-w-6xl px-8 py-12">
          <p className="font-[var(--font-mono)] text-sm text-[var(--mauve)]">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[92vh] bg-[var(--stage)] text-[var(--parchment)]">
      <DirectorNav confirmBeforeLeave={isDirty} />

      <main className="mx-auto max-w-6xl px-8 py-12">
        {metaError && (
          <div className="mb-6 rounded-[3px] border border-[rgba(224,138,107,0.4)] bg-[rgba(224,138,107,0.12)] px-4 py-3 text-sm text-[var(--error)]">
            {metaError}
          </div>
        )}
        {metaSaved && (
          <div className="mb-6 rounded-[3px] border border-[var(--gold)] bg-[rgba(217,166,83,0.08)] px-4 py-3 text-sm text-[var(--gold-soft)]">
            Changes saved.
          </div>
        )}

        <motion.form
          onSubmit={handleMetaSubmit}
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
          className="edit-orbit-grid -mt-8"
        >
          {/* video / reupload */}
          <motion.div
            variants={{
              hidden: { opacity: 0, scale: 0.92, y: 20 },
              visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 90, damping: 18 } },
            }}
            className="relative flex h-full min-h-[300px] flex-col"
          >
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(217,166,83,0.035)] blur-3xl" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(217,166,83,0.06)]" />

            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
              className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[rgba(217,166,83,0.045)]"
            />

            <div className="relative flex h-full flex-1 flex-col">
              <div className="mb-3 flex items-center justify-center gap-2">
                <Film size={13} strokeWidth={1.5} className="text-[var(--gold)]" />
                <label className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.16em] text-[var(--mauve)]">
                  Film
                </label>
              </div>

              {!newFilmPreviewUrl && (
                <div className="relative flex min-h-[260px] flex-col items-center justify-center overflow-hidden rounded-[6px] border border-[rgba(239,231,218,0.2)] bg-[#0f0c11] px-8 py-10 text-center">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
                  ) : null}
                  <div className="relative">
                    <h2 className="mb-1 font-[var(--font-display)] text-lg font-medium text-[var(--parchment)]">
                      {video.title}
                    </h2>
                    <div className="mb-4 flex justify-center gap-2">
                      <StatusBadge status={video.moderationStatus} />
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-[3px] border border-[rgba(239,231,218,0.2)] bg-[#17131a] px-4 py-2 text-xs font-medium text-[var(--parchment)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold-soft)]">
                      <RefreshCw size={13} strokeWidth={1.5} />
                      Replace video file
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
                  </div>
                </div>
              )}

              {newFilmPreviewUrl && (
                <div className="relative mt-3 overflow-hidden rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-black">
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
                    <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-[rgba(16,13,16,0.55)] p-3">
                      <button
                        type="button"
                        onClick={handleReupload}
                        className="rounded-[3px] bg-[var(--gold)] px-4 py-1.5 text-xs font-semibold text-[#1a1210] hover:bg-[var(--gold-soft)]"
                      >
                        Upload replacement
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (newFilmPreviewUrl) URL.revokeObjectURL(newFilmPreviewUrl);
                          setNewFilm(null);
                          setNewFilmPreviewUrl(null);
                        }}
                        className="rounded-[3px] border border-[rgba(239,231,218,0.2)] px-4 py-1.5 text-xs text-[var(--parchment)] hover:border-[var(--gold)]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {reuploading && (
                    <div className="absolute inset-0 flex flex-col justify-end bg-[rgba(16,13,16,0.55)] p-4">
                      {reuploadPhase === "uploading" && (
                        <>
                          <div className="mb-1.5 flex justify-between font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.06em] text-[var(--parchment)]">
                            <span>Uploading</span>
                            <span>{reuploadPercent}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(239,231,218,0.25)]">
                            <div className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-150 ease-out" style={{ width: `${reuploadPercent}%` }} />
                          </div>
                        </>
                      )}
                      {reuploadPhase === "processing" && (
                        <>
                          <div className="mb-1.5 flex justify-between font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.06em] text-[var(--parchment)]">
                            <span>Processing (estimated)</span>
                            <span>{reuploadProcessingPercent}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(239,231,218,0.25)]">
                            <div className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-500 ease-out" style={{ width: `${reuploadProcessingPercent}%` }} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {reuploadError && <p className="mt-2 text-xs text-[var(--error)]">{reuploadError}</p>}
            </div>
          </motion.div>

          {/* moderation / resubmit */}
          <div className="flex flex-col justify-between rounded-[4px] border border-[rgba(239,231,218,0.16)] bg-[rgba(15,12,17,0.55)] p-5">
            <div className="flex items-center gap-2">
              <StatusIcon status={video.moderationStatus} />
              <p className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.14em] text-[var(--gold)]">
                Moderation
              </p>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[var(--mauve)]">
              {video.moderationStatus === "approved" && "This film is live and publicly visible."}
              {video.moderationStatus === "pending" && "Awaiting review — not yet public."}
              {video.moderationStatus === "rejected" && (video.moderationComment || "This film was rejected. Address the notes and resubmit.")}
            </p>
            {video.moderationStatus === "rejected" && (
              <>
                <button
                  type="button"
                  onClick={handleResubmit}
                  disabled={resubmitting}
                  className="mt-4 rounded-[3px] border border-[rgba(217,166,83,0.4)] px-4 py-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.06em] text-[var(--gold-soft)] hover:bg-[rgba(217,166,83,0.1)] disabled:opacity-50"
                >
                  {resubmitting ? "Resubmitting…" : "Resubmit for review"}
                </button>
                {resubmitError && <p className="mt-2 text-xs text-[var(--error)]">{resubmitError}</p>}
              </>
            )}
          </div>

          {/* title */}
          <motion.div
            variants={{ hidden: { opacity: 0, x: -18 }, visible: { opacity: 1, x: 0 } }}
            className="group relative h-30 rounded-[4px] border border-[rgba(239,231,218,0.12)] bg-[rgba(15,12,17,0.72)] p-4 backdrop-blur-sm transition-colors hover:border-[rgba(217,166,83,0.35)]"
          >
            <div className="mb-2 flex items-center gap-3">
              <span className="h-px flex-1 bg-[rgba(217,166,83,0.18)]" />
              <label className="flex items-center gap-1.5 font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.18em] text-[var(--gold)]">
                Film Title
              </label>
              <span className="h-px flex-1 bg-[rgba(217,166,83,0.18)]" />
            </div>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-4 py-3 text-base text-[var(--parchment)] transition-all duration-300 focus:border-[var(--gold)] focus:bg-[rgba(217,166,83,0.025)] focus:outline-none focus:ring-1 focus:ring-[rgba(217,166,83,0.15)]"
            />
          </motion.div>

          {/* description */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
              <AlignLeft size={12} strokeWidth={1.5} /> Description
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
            <label className="mb-1.5 flex items-center gap-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
              <TagsIcon size={12} strokeWidth={1.5} /> Tags <span className="normal-case text-[var(--mauve)]">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>

          {/* language / country / year */}
          <div className="grid grid-rows-1 gap-2 sm:grid-rows-3">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 whitespace-nowrap font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                <Globe2 size={12} strokeWidth={1.5} /> Language
              </label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 whitespace-nowrap block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                Country
              </label>
              <input
                type="text"
                value={productionCountry}
                onChange={(e) => setProductionCountry(e.target.value)}
                className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 whitespace-nowrap font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                <CalendarDays size={12} strokeWidth={1.5} /> Year
              </label>
              <input
                type="number"
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value)}
                className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
              />
            </div>
          </div>

          {/* thumbnail url */}
          <div>
            <label className="-mt-35 flex items-center gap-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
              <ImageIcon size={12} strokeWidth={1.5} /> Thumbnail URL
            </label>
            <input
              type="text"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>

          {/* cast */}
          <div className="relative z-10">
            <label className={`${newFilm ? "-mt-30" : "-mt-48"} flex items-center gap-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]`}>
              <Users size={12} strokeWidth={1.5} /> Cast
            </label>
            <CastSlider cast={cast} setCast={setCast} />
          </div>

          <div className="relative z-10">
            <button
              type="submit"
              disabled={savingMeta}
              className="mx-auto flex h-10 w-full max-w-[420px] items-center justify-center rounded-[3px] bg-[var(--gold)] py-3 font-[var(--font-body)] text-sm font-semibold leading-none text-[#1a1210] transition-colors hover:bg-[var(--gold-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingMeta ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </motion.form>

        <style>{`
          .edit-orbit-grid {
            position: relative;
            display: grid;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            column-gap: 2.5rem;
            row-gap: 1.1rem;
            padding: 1.25rem 0 1rem;
          }
          .edit-orbit-grid > * { min-width: 0; }

          .edit-orbit-grid > :nth-child(1) { grid-column: 4 / span 6; grid-row: 1 / span 3; }
          .edit-orbit-grid > :nth-child(2) { grid-column: 10 / span 3; grid-row: 2; }
          .edit-orbit-grid > :nth-child(3) { grid-column: 1 / span 3; grid-row: 1; }
          .edit-orbit-grid > :nth-child(4) { grid-column: 1 / span 3; grid-row: 2; }
          .edit-orbit-grid > :nth-child(5) { grid-column: 10 / span 3; grid-row: 1; }
          .edit-orbit-grid > :nth-child(6) { grid-column: 1 / span 3; grid-row: 3; }
          .edit-orbit-grid > :nth-child(7) { grid-column: 10 / span 3; grid-row: 3; }
          .edit-orbit-grid > :nth-child(8) { grid-column: 1 / span 3; grid-row: 4; }
          .edit-orbit-grid > :nth-child(9) { grid-column: 4 / span 6; grid-row: 4 / span 2; }
          .edit-orbit-grid > :nth-child(10) { grid-column: 4 / span 6; grid-row: 6; }

          @media (max-width: 900px) {
            .edit-orbit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .edit-orbit-grid > * { grid-column: auto !important; grid-row: auto !important; }
            .edit-orbit-grid > :nth-child(1) { grid-column: 1 / -1 !important; grid-row: 1 !important; order: -10; }
          }

          @media (max-width: 640px) {
            .edit-orbit-grid { display: flex; flex-direction: column; gap: 1rem; }
            .edit-orbit-grid > :nth-child(1) { order: -10; }
          }
        `}</style>
      </main>
    </div>
  );
}