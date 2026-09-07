import React, {
  useEffect,
  useState,
} from "react";
import {
  AlertTriangle,
  Check,
  RefreshCw,
  Star,
  StickyNote,
  X,
} from "lucide-react";
import {
  getRequest,
  postEmpty,
  postJson,
  putJson,
} from "../../api/client.js";
import AdminVideoPlayer from "../../components/admin/AdminVideoPlayer.jsx";

export default function Review() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const [watchData, setWatchData] = useState(null);
  const [watchLoading, setWatchLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  const [contentWarningsText, setContentWarningsText] = useState("");
  const [cwBusy, setCwBusy] = useState(false);

  const [featuredBusy, setFeaturedBusy] = useState(false);
  const [ageBusy, setAgeBusy] = useState(false);

  const [directorDetail, setDirectorDetail] = useState(null);
  const [directorBusy, setDirectorBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await getRequest("/admin/videos?status=pending");
      setVideos(Array.isArray(data?.videos) ? data.videos : []);
    } catch (err) {
      setVideos([]);
      setError(err.message || "Unable to load review queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openReview(video) {
    setSelected(video);
    setSelectedDetail(video);
    setWatchData(null);
    setComment("");
    setWatchLoading(true);
    setDetailLoading(true);
    setError("");

    setNotes([]);
    setNotesLoading(true);
    setContentWarningsText((video.contentWarnings || []).join(", "));
    setDirectorDetail(null);

    const [detailResult, watchResult, notesResult, directorResult] =
      await Promise.allSettled([
        getRequest(`/admin/videos/${video._id}`),
        getRequest(`/admin/videos/${video._id}/watch`),
        getRequest(`/admin/videos/${video._id}/notes`),
        video.directorId
          ? getRequest(`/admin/directors/${video.directorId}`)
          : Promise.resolve(null),
      ]);

    if (detailResult.status === "fulfilled") {
      setSelectedDetail(detailResult.value);
      setContentWarningsText(
        (detailResult.value?.contentWarnings || []).join(", ")
      );
    }

    if (watchResult.status === "fulfilled") {
      setWatchData(watchResult.value);
    }

    if (notesResult.status === "fulfilled") {
      setNotes(
        Array.isArray(notesResult.value?.notes)
          ? notesResult.value.notes
          : []
      );
    }

    if (directorResult.status === "fulfilled" && directorResult.value) {
      setDirectorDetail(directorResult.value);
    }

    if (
      detailResult.status === "rejected" &&
      watchResult.status === "rejected"
    ) {
      setError(
        detailResult.reason?.message ||
          watchResult.reason?.message ||
          "Unable to load video."
      );
    }

    setDetailLoading(false);
    setWatchLoading(false);
    setNotesLoading(false);
  }

  function closeReview() {
    setSelected(null);
    setSelectedDetail(null);
    setWatchData(null);
    setComment("");
    setNotes([]);
    setNoteText("");
    setContentWarningsText("");
    setDirectorDetail(null);
  }

  async function moderate(kind) {
    if (!selected) return;

    if (kind === "reject" && comment.trim().length < 3) {
      setError("Please provide a rejection reason.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (kind === "approve") {
        await postJson(`/admin/videos/${selected._id}/approve`, {
          comment: comment.trim() || null,
        });
      } else {
        await postJson(`/admin/videos/${selected._id}/reject`, {
          reason: comment.trim(),
        });
      }

      closeReview();
      await load();
    } catch (err) {
      setError(err.message || "Moderation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFeatured() {
    const video = selectedDetail || selected;
    if (!video) return;

    setFeaturedBusy(true);
    setError("");

    try {
      await postJson(`/admin/videos/${video._id}/featured`, {
        isFeatured: !video.isFeatured,
      });

      const updated = await getRequest(`/admin/videos/${video._id}`);
      setSelectedDetail(updated);
    } catch (err) {
      setError(err.message || "Unable to update featured status.");
    } finally {
      setFeaturedBusy(false);
    }
  }

  async function toggleAgeRestriction() {
    const video = selectedDetail || selected;
    if (!video) return;

    setAgeBusy(true);
    setError("");

    try {
      await postJson(`/admin/videos/${video._id}/age-restriction`, {
        ageRestricted: !video.ageRestricted,
      });

      const updated = await getRequest(`/admin/videos/${video._id}`);
      setSelectedDetail(updated);
    } catch (err) {
      setError(err.message || "Unable to update age restriction.");
    } finally {
      setAgeBusy(false);
    }
  }

  async function saveContentWarnings() {
    const video = selectedDetail || selected;
    if (!video) return;

    setCwBusy(true);
    setError("");

    try {
      const warnings = contentWarningsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      await putJson(`/admin/videos/${video._id}/content-warnings`, {
        contentWarnings: warnings,
      });

      const updated = await getRequest(`/admin/videos/${video._id}`);
      setSelectedDetail(updated);
    } catch (err) {
      setError(err.message || "Unable to save content warnings.");
    } finally {
      setCwBusy(false);
    }
  }

  async function addNote() {
    const video = selectedDetail || selected;
    if (!video || !noteText.trim()) return;

    setNoteBusy(true);
    setError("");

    try {
      await postJson(`/admin/videos/${video._id}/notes`, {
        note: noteText.trim(),
      });

      setNoteText("");

      const data = await getRequest(`/admin/videos/${video._id}/notes`);
      setNotes(Array.isArray(data?.notes) ? data.notes : []);
    } catch (err) {
      setError(err.message || "Unable to add note.");
    } finally {
      setNoteBusy(false);
    }
  }

  async function suspendDirector() {
    if (!directorDetail?.director?._id) return;

    const reason = window.prompt("Reason for suspending this director:");
    if (!reason || reason.trim().length < 3) return;

    setDirectorBusy(true);
    setError("");

    try {
      await postJson(
        `/admin/directors/${directorDetail.director._id}/suspend`,
        { reason: reason.trim() }
      );

      const updated = await getRequest(
        `/admin/directors/${directorDetail.director._id}`
      );
      setDirectorDetail(updated);
    } catch (err) {
      setError(err.message || "Unable to suspend director.");
    } finally {
      setDirectorBusy(false);
    }
  }

  async function unsuspendDirector() {
    if (!directorDetail?.director?._id) return;

    setDirectorBusy(true);
    setError("");

    try {
      await postEmpty(
        `/admin/directors/${directorDetail.director._id}/unsuspend`
      );

      const updated = await getRequest(
        `/admin/directors/${directorDetail.director._id}`
      );
      setDirectorDetail(updated);
    } catch (err) {
      setError(err.message || "Unable to reinstate director.");
    } finally {
      setDirectorBusy(false);
    }
  }

  const activeVideo = selectedDetail || selected;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[.2em] text-[#d9a653]">
            Moderation
          </p>

          <h2 className="mt-2 font-[var(--font-display)] text-3xl">
            Review queue
          </h2>

          <p className="mt-2 text-sm text-[#8b7c82]">
            Click a video to review it before publishing to viewers.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2.5 text-[10px] uppercase tracking-[.12em] disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/[0.07] p-4 text-sm text-[#e08a6b]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-80 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : videos.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => (
            <article
              key={video._id}
              className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]"
            >
              <button
                onClick={() => openReview(video)}
                className="block w-full"
                aria-label={`Review ${video.title || "video"}`}
              >
                <img
                  src={video.thumbnailUrl || ""}
                  alt=""
                  className="aspect-video w-full bg-black object-cover transition hover:brightness-110"
                />
              </button>

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-[var(--font-display)] text-lg">
                      {video.title || "Untitled video"}
                    </h3>

                    <p className="mt-1 text-[10px] text-[#71656a]">
                      {video.uploadedAt
                        ? new Date(video.uploadedAt).toLocaleString()
                        : "Upload date unavailable"}
                    </p>
                  </div>

                  <span className="rounded-full border border-[#d9a653]/25 px-2 py-1 text-[8px] uppercase tracking-[.08em] text-[#d9a653]">
                    Pending
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#8b7c82]">
                  {video.description || "No description supplied."}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] p-12 text-center">
          <p className="text-sm text-[#71656a]">
            The review queue is empty.
          </p>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!busy) closeReview();
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#171216] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[.18em] text-[#d9a653]">
                  Film review
                </p>

                <h3 className="mt-2 truncate font-[var(--font-display)] text-2xl">
                  {activeVideo?.title || "Video"}
                </h3>
              </div>

              <button
                disabled={busy}
                onClick={closeReview}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              {watchLoading ? (
                <div className="grid aspect-video place-items-center rounded-2xl bg-black">
                  <RefreshCw
                    size={20}
                    className="animate-spin text-[#d9a653]"
                  />
                </div>
              ) : watchData?.stream_url ? (
                <AdminVideoPlayer
                  src={watchData.stream_url}
                  poster={activeVideo?.thumbnailUrl}
                  title={activeVideo?.title}
                />
              ) : (
                <div className="grid aspect-video place-items-center rounded-2xl bg-black">
                  <p className="text-sm text-[#8b7c82]">
                    The backend did not return a stream URL.
                  </p>
                </div>
              )}

              {!detailLoading && (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Info label="Status" value={activeVideo?.moderationStatus || "—"} />
                  <Info label="Language" value={activeVideo?.language || "—"} />
                  <Info
                    label="Uploaded"
                    value={
                      activeVideo?.uploadedAt
                        ? new Date(activeVideo.uploadedAt).toLocaleString()
                        : "—"
                    }
                  />
                </div>
              )}

              <div className="mt-5 rounded-xl bg-white/[0.03] p-4">
                <p className="text-[9px] uppercase tracking-[.12em] text-[#71656a]">
                  Description
                </p>

                <p className="mt-2 text-sm leading-relaxed text-[#b8acb0]">
                  {activeVideo?.description || "No description supplied."}
                </p>
              </div>

              {Array.isArray(activeVideo?.cast) && activeVideo.cast.length > 0 && (
                <div className="mt-4 rounded-xl bg-white/[0.03] p-4">
                  <p className="text-[9px] uppercase tracking-[.12em] text-[#71656a]">
                    Cast
                  </p>

                  <div className="mt-3 flex flex-wrap gap-3">
                    {activeVideo.cast.map((member, index) => (
                      <div
                        key={member._id || index}
                        className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2 pr-3"
                      >
                        {member.photoUrl ? (
                          <img
                            src={member.photoUrl}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#5c1220] text-[10px] font-bold text-[#e6c184]">
                            {(member.name || "?")[0]?.toUpperCase()}
                          </span>
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-xs text-[#e5dcde]">
                            {member.name || "Unnamed"}
                          </p>

                          {member.characterName && (
                            <p className="truncate text-[9px] text-[#71656a]">
                              as {member.characterName}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] uppercase tracking-[.12em] text-[#71656a]">
                      Age restriction
                    </p>
                    <AlertTriangle size={14} className="text-[#e08a6b]" />
                  </div>

                  <button
                    disabled={ageBusy}
                    onClick={toggleAgeRestriction}
                    className={`mt-3 w-full rounded-lg border px-3 py-2 text-[9px] uppercase tracking-[.08em] disabled:opacity-50 ${
                      activeVideo?.ageRestricted
                        ? "border-[#e08a6b]/40 text-[#e08a6b]"
                        : "border-white/[0.08] text-[#b8acb0]"
                    }`}
                  >
                    {activeVideo?.ageRestricted
                      ? "Restricted — click to clear"
                      : "Not restricted — click to restrict"}
                  </button>
                </div>

                <div className="rounded-xl bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] uppercase tracking-[.12em] text-[#71656a]">
                      Featured
                    </p>
                    <Star size={14} className="text-[#d9a653]" />
                  </div>

                  <button
                    disabled={featuredBusy}
                    onClick={toggleFeatured}
                    className={`mt-3 w-full rounded-lg border px-3 py-2 text-[9px] uppercase tracking-[.08em] disabled:opacity-50 ${
                      activeVideo?.isFeatured
                        ? "border-[#d9a653]/50 text-[#d9a653]"
                        : "border-white/[0.08] text-[#b8acb0]"
                    }`}
                  >
                    {activeVideo?.isFeatured
                      ? "Featured — click to unfeature"
                      : "Not featured — click to feature"}
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-white/[0.03] p-4">
                <p className="text-[9px] uppercase tracking-[.12em] text-[#71656a]">
                  Content warnings
                </p>

                <textarea
                  value={contentWarningsText}
                  onChange={(event) => setContentWarningsText(event.target.value)}
                  rows={2}
                  placeholder="Comma-separated, e.g. violence, flashing lights"
                  className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/40"
                />

                <button
                  disabled={cwBusy}
                  onClick={saveContentWarnings}
                  className="mt-2 rounded-lg border border-white/[0.08] px-3 py-2 text-[9px] uppercase tracking-[.08em] text-[#b8acb0] disabled:opacity-50"
                >
                  Save content warnings
                </button>
              </div>

              <div className="mt-4 rounded-xl bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-[.12em] text-[#71656a]">
                    Internal admin notes
                  </p>
                  <StickyNote size={14} className="text-[#71656a]" />
                </div>

                {notesLoading ? (
                  <p className="mt-3 text-xs text-[#71656a]">Loading notes…</p>
                ) : notes.length ? (
                  <div className="mt-3 space-y-2">
                    {notes.map((note, index) => (
                      <div
                        key={index}
                        className="rounded-lg bg-white/[0.03] p-2 text-xs text-[#b8acb0]"
                      >
                        <p>{note.note}</p>
                        <p className="mt-1 text-[9px] text-[#71656a]">
                          {note.addedAt
                            ? new Date(note.addedAt).toLocaleString()
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#71656a]">
                    No internal notes yet — these are never shown to the director.
                  </p>
                )}

                <textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  rows={2}
                  placeholder="Add a private note visible only to admins…"
                  className="mt-3 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/40"
                />

                <button
                  disabled={noteBusy || !noteText.trim()}
                  onClick={addNote}
                  className="mt-2 rounded-lg border border-white/[0.08] px-3 py-2 text-[9px] uppercase tracking-[.08em] text-[#b8acb0] disabled:opacity-50"
                >
                  Add note
                </button>
              </div>

              {directorDetail && (
                <div className="mt-4 rounded-xl bg-white/[0.03] p-4">
                  <p className="text-[9px] uppercase tracking-[.12em] text-[#71656a]">
                    Director
                  </p>

                  <p className="mt-2 text-sm text-[#e5dcde]">
                    {directorDetail.director?.username || "Unknown director"}
                  </p>

                  <p className="mt-1 text-[10px] text-[#71656a]">
                    Status: {directorDetail.director?.accountStatus || "active"}
                    {" · "}
                    {directorDetail.videoCount ?? 0} video
                    {directorDetail.videoCount === 1 ? "" : "s"}
                  </p>

                  {directorDetail.director?.accountStatus === "suspended" ? (
                    <button
                      disabled={directorBusy}
                      onClick={unsuspendDirector}
                      className="mt-3 rounded-lg border border-white/[0.08] px-3 py-2 text-[9px] uppercase tracking-[.08em] text-[#b8acb0] disabled:opacity-50"
                    >
                      Reinstate director
                    </button>
                  ) : (
                    <button
                      disabled={directorBusy}
                      onClick={suspendDirector}
                      className="mt-3 rounded-lg border border-[#e08a6b]/30 px-3 py-2 text-[9px] uppercase tracking-[.08em] text-[#e08a6b] disabled:opacity-50"
                    >
                      Suspend director
                    </button>
                  )}
                </div>
              )}

              <div className="mt-5">
                <label className="text-[9px] uppercase tracking-[.14em] text-[#71656a]">
                  Moderator note
                </label>

                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Optional approval note or required rejection reason…"
                  className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/40"
                />
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  disabled={busy || comment.trim().length < 3}
                  onClick={() => moderate("reject")}
                  className="flex-1 rounded-xl border border-[#e08a6b]/30 px-4 py-3 text-[10px] uppercase tracking-[.1em] text-[#e08a6b] disabled:opacity-40"
                >
                  <X size={14} className="mr-1 inline" />
                  Reject
                </button>

                <button
                  disabled={busy}
                  onClick={() => moderate("approve")}
                  className="flex-1 rounded-xl bg-[#d9a653] px-4 py-3 text-[10px] font-semibold uppercase tracking-[.1em] text-[#100d10] disabled:opacity-50"
                >
                  <Check size={14} className="mr-1 inline" />
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3">
      <p className="text-[9px] uppercase tracking-[.12em] text-[#71656a]">
        {label}
      </p>
      <p className="mt-1 text-xs text-[#d9d0d2]">{value}</p>
    </div>
  );
}