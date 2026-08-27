import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DirectorNav from "../../components/DirectorNav.jsx";
import { postForm } from "../../api/client";

const GENRE_OPTIONS = [
  "Drama", "Comedy", "Thriller", "Horror", "Documentary",
  "Sci-Fi", "Romance", "Animation", "Action", "Experimental",
];

function emptyCastMember() {
  return { id: crypto.randomUUID(), name: "", characterName: "", photoFile: null };
}

export default function UploadVideo() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genres, setGenres] = useState([]);
  const [tags, setTags] = useState("");
  const [language, setLanguage] = useState("");
  const [productionCountry, setProductionCountry] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [film, setFilm] = useState(null);
  const [filmPreviewUrl, setFilmPreviewUrl] = useState(null);

  useEffect(() => {
    return () => {
      if (filmPreviewUrl) URL.revokeObjectURL(filmPreviewUrl);
    };
  }, [filmPreviewUrl]);
  const [cast, setCast] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | uploading | processing

  function toggleGenre(g) {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  function addCastMember() {
    setCast((prev) => [...prev, emptyCastMember()]);
  }

  function updateCastMember(id, field, value) {
    setCast((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  function removeCastMember(id) {
    setCast((prev) => prev.filter((c) => c.id !== id));
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
    if (releaseYear) fd.append("releaseYear", releaseYear);
    fd.append(
      "cast",
      JSON.stringify(cast.map((c) => ({ clientId: c.id, name: c.name, characterName: c.characterName })))
    );
    cast.forEach((c) => {
      if (c.photoFile) fd.append(`cast_photo_${c.id}`, c.photoFile);
    });

    setSubmitting(true);
    setPhase("uploading");
    setUploadPercent(0);
    try {
      const data = await postForm("/directors/upload-video", fd, (pct) => {
        setUploadPercent(pct);
        // once the file itself has fully arrived, the backend moves on to
        // ffmpeg transcoding — a step this endpoint gives no progress for
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

      <main className="mx-auto max-w-3xl px-6 py-12">
        <span className="mb-2 inline-block font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.16em] text-[var(--gold)]">
          Upload
        </span>
        <h1 className="mb-8 font-[var(--font-display)] text-3xl font-medium text-[var(--parchment)]">
          Submit a New Film
        </h1>

        {error && (
          <div className="mb-6 rounded-[3px] border border-[rgba(224,138,107,0.4)] bg-[rgba(224,138,107,0.12)] px-4 py-3 text-sm text-[var(--error)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* film file */}
          <div>
            <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
              Video File
            </label>
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
              className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] file:mr-3 file:rounded-[3px] file:border-0 file:bg-[var(--gold)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#1a1210]"
            />

            {filmPreviewUrl && (
              <div className="relative mt-3 overflow-hidden rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-black">
                <video
                  src={filmPreviewUrl}
                  muted
                  playsInline
                  className="aspect-video w-full object-contain"
                  onLoadedData={(e) => {
                    e.currentTarget.currentTime = 1; // land on a real frame, not black
                  }}
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
                        <div className="mb-1.5 font-[var(--font-mono)] text-[0.7rem] uppercase tracking-[0.06em] text-[var(--parchment)]">
                          Transcoding — this can take a while
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(239,231,218,0.25)]">
                          <div className="h-full w-1/3 animate-[indeterminate_1.3s_ease-in-out_infinite] rounded-full bg-[var(--gold)]" />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* title */}
          <div>
            <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>

          {/* description */}
          <div>
            <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
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
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((g) => (
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
          </div>

          {/* tags */}
          <div>
            <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
              Tags <span className="normal-case text-[var(--mauve)]">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="noir, single-take, festival-cut"
              className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>

          {/* language / country / year row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                Language
              </label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                Production Country
              </label>
              <input
                type="text"
                value={productionCountry}
                onChange={(e) => setProductionCountry(e.target.value)}
                className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] focus:border-[var(--gold)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                Release Year
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
            <label className="mb-1.5 block font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
              Thumbnail URL
            </label>
            <input
              type="text"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-3 py-2.5 text-sm text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>

          {/* cast */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.1em] text-[var(--mauve)]">
                Cast
              </label>
              <button
                type="button"
                onClick={addCastMember}
                className="rounded-[3px] border border-[rgba(239,231,218,0.16)] px-2.5 py-1 font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.06em] text-[var(--parchment)] hover:border-[var(--gold)]"
              >
                + Add
              </button>
            </div>

            {cast.length === 0 && (
              <p className="text-sm text-[var(--mauve)]">No cast members added.</p>
            )}

            <div className="space-y-3">
              {cast.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-2 rounded-[3px] border border-[rgba(239,231,218,0.16)] p-3"
                >
                  <input
                    type="text"
                    placeholder="Actor name"
                    value={c.name}
                    onChange={(e) => updateCastMember(c.id, "name", e.target.value)}
                    className="min-w-[140px] flex-1 rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-2.5 py-1.5 text-sm text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Character name"
                    value={c.characterName}
                    onChange={(e) => updateCastMember(c.id, "characterName", e.target.value)}
                    className="min-w-[140px] flex-1 rounded-[3px] border border-[rgba(239,231,218,0.16)] bg-[#0f0c11] px-2.5 py-1.5 text-sm text-[var(--parchment)] placeholder:text-[rgba(139,124,130,0.6)] focus:border-[var(--gold)] focus:outline-none"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => updateCastMember(c.id, "photoFile", e.target.files?.[0] ?? null)}
                    className="text-xs text-[var(--mauve)] file:mr-2 file:rounded-[3px] file:border-0 file:bg-[var(--velvet)] file:px-2 file:py-1 file:text-xs file:text-[var(--gold-soft)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeCastMember(c.id)}
                    className="ml-auto font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.06em] text-[var(--error)] hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-[3px] bg-[var(--gold)] py-3 font-[var(--font-body)] text-sm font-semibold text-[#1a1210] transition-colors hover:bg-[var(--gold-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Working…" : "Upload Film"}
          </button>
        </form>
      </main>
    </div>
  );
}