import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  Check,
  Eye,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
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
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import AdminVideoPlayer from "../../components/admin/AdminVideoPlayer.jsx";

function normalizeVideos(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.videos)) {
    return data.videos;
  }
  if (Array.isArray(data?.data)) {
    return data.data;
  }
  if (Array.isArray(data?.results)) {
    return data.results;
  }
  return [];
}

function statusClass(status) {
  if (status === "approved") {
    return "border-[#7fc59b]/25 text-[#7fc59b]";
  }

  if (status === "rejected") {
    return "border-[#e08a6b]/25 text-[#e08a6b]";
  }

  if (status === "pending") {
    return "border-[#d9a653]/25 text-[#d9a653]";
  }

  return "border-white/[0.1] text-[#a99da1]";
}

export default function Content() {
  const [videos, setVideos] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);
  const [selectedDetail, setSelectedDetail] =
    useState(null);

  const [watchData, setWatchData] =
    useState(null);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [watchLoading, setWatchLoading] =
    useState(false);

  const [action, setAction] = useState(null);

  const [moderationText, setModerationText] =
    useState("");

  const [moderationBusy, setModerationBusy] =
    useState(false);

  const [selectedIds, setSelectedIds] = useState(
    () => new Set()
  );
  const [bulkBusy, setBulkBusy] = useState(false);

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] =
    useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  const [contentWarningsText, setContentWarningsText] =
    useState("");
  const [cwBusy, setCwBusy] = useState(false);

  const [featuredBusy, setFeaturedBusy] =
    useState(false);
  const [ageBusy, setAgeBusy] = useState(false);

  const [directorDetail, setDirectorDetail] =
    useState(null);
  const [directorBusy, setDirectorBusy] =
    useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const path =
        status === "all"
          ? "/admin/videos"
          : `/admin/videos?status=${encodeURIComponent(
              status
            )}`;

      const data = await getRequest(path);

      setVideos(normalizeVideos(data));
    } catch (err) {
      setVideos([]);
      setError(
        err.message || "Unable to load videos."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  const filteredVideos = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return videos;
    }

    return videos.filter((video) => {
      return [
        video.title,
        video.description,
        video.language,
        video.directorId,
      ]
        .filter(Boolean)
        .some((field) =>
          String(field)
            .toLowerCase()
            .includes(value)
        );
    });
  }, [videos, query]);

  async function openVideo(video) {
    setSelected(video);
    setSelectedDetail(video);
    setWatchData(null);
    setDetailLoading(true);
    setWatchLoading(true);
    setError("");

    setNotes([]);
    setNotesLoading(true);
    setContentWarningsText(
      (video.contentWarnings || []).join(", ")
    );
    setDirectorDetail(null);

    const [
      detailResult,
      watchResult,
      notesResult,
      directorResult,
    ] = await Promise.allSettled([
      getRequest(`/admin/videos/${video._id}`),
      getRequest(`/admin/videos/${video._id}/watch`),
      getRequest(`/admin/videos/${video._id}/notes`),
      video.directorId
        ? getRequest(
            `/admin/directors/${video.directorId}`
          )
        : Promise.resolve(null),
    ]);

    if (detailResult.status === "fulfilled") {
      setSelectedDetail(detailResult.value);
      setContentWarningsText(
        (detailResult.value?.contentWarnings || []).join(
          ", "
        )
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

    if (
      directorResult.status === "fulfilled" &&
      directorResult.value
    ) {
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

  function closeVideo() {
    setSelected(null);
    setSelectedDetail(null);
    setWatchData(null);
    setModerationText("");
    setModerationBusy(false);
    setNotes([]);
    setNoteText("");
    setContentWarningsText("");
    setDirectorDetail(null);
  }

  function askModeration(kind, video) {
    setAction({
      kind,
      video,
    });

    setModerationText("");
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function bulkModerate(kind) {
    if (!selectedIds.size) return;

    if (kind === "reject") {
      setAction({
        kind: "bulk-reject",
        count: selectedIds.size,
      });
      setModerationText("");
      return;
    }

    bulkApprove();
  }

  async function bulkApprove() {
    setBulkBusy(true);
    setError("");

    try {
      await postJson("/admin/videos/bulk-approve", {
        videoIds: Array.from(selectedIds),
        comment: null,
      });

      setSelectedIds(new Set());
      await load();
    } catch (err) {
      setError(err.message || "Bulk approve failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function toggleFeatured(video) {
    if (!video) return;

    setFeaturedBusy(true);
    setError("");

    try {
      await postJson(
        `/admin/videos/${video._id}/featured`,
        { isFeatured: !video.isFeatured }
      );

      if (selected?._id === video._id) {
        const updated = await getRequest(
          `/admin/videos/${video._id}`
        );
        setSelectedDetail(updated);
      }

      await load();
    } catch (err) {
      setError(
        err.message || "Unable to update featured status."
      );
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
      await postJson(
        `/admin/videos/${video._id}/age-restriction`,
        { ageRestricted: !video.ageRestricted }
      );

      const updated = await getRequest(
        `/admin/videos/${video._id}`
      );
      setSelectedDetail(updated);
      await load();
    } catch (err) {
      setError(
        err.message || "Unable to update age restriction."
      );
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

      await putJson(
        `/admin/videos/${video._id}/content-warnings`,
        { contentWarnings: warnings }
      );

      const updated = await getRequest(
        `/admin/videos/${video._id}`
      );
      setSelectedDetail(updated);
      await load();
    } catch (err) {
      setError(
        err.message || "Unable to save content warnings."
      );
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

      const data = await getRequest(
        `/admin/videos/${video._id}/notes`
      );
      setNotes(
        Array.isArray(data?.notes) ? data.notes : []
      );
    } catch (err) {
      setError(err.message || "Unable to add note.");
    } finally {
      setNoteBusy(false);
    }
  }

  async function suspendDirector() {
    if (!directorDetail?.director?._id) return;

    const reason = window.prompt(
      "Reason for suspending this director:"
    );

    if (!reason || reason.trim().length < 3) {
      return;
    }

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
      setError(
        err.message || "Unable to suspend director."
      );
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
      setError(
        err.message || "Unable to reinstate director."
      );
    } finally {
      setDirectorBusy(false);
    }
  }

  async function moderateVideo() {
    if (action?.kind === "bulk-reject") {
      if (moderationText.trim().length < 3) {
        setError(
          "A rejection reason must contain at least 3 characters."
        );
        return;
      }

      setModerationBusy(true);
      setError("");

      try {
        await postJson("/admin/videos/bulk-reject", {
          videoIds: Array.from(selectedIds),
          reason: moderationText.trim(),
        });

        setAction(null);
        setModerationText("");
        setSelectedIds(new Set());
        await load();
      } catch (err) {
        setError(err.message || "Bulk reject failed.");
      } finally {
        setModerationBusy(false);
      }

      return;
    }

    if (!action?.video) {
      return;
    }

    const { kind, video } = action;

    if (
      kind === "reject" &&
      moderationText.trim().length < 3
    ) {
      setError(
        "A rejection reason must contain at least 3 characters."
      );
      return;
    }

    setModerationBusy(true);
    setError("");

    try {
      if (kind === "approve") {
        await postJson(
          `/admin/videos/${video._id}/approve`,
          {
            comment:
              moderationText.trim() || null,
          }
        );
      }

      if (kind === "reject") {
        await postJson(
          `/admin/videos/${video._id}/reject`,
          {
            reason: moderationText.trim(),
          }
        );
      }

      if (kind === "reset") {
        await postEmpty(
          `/admin/videos/${video._id}/reset`
        );
      }

      setAction(null);
      setModerationText("");

      await load();

      if (selected?._id === video._id) {
        closeVideo();
      }
    } catch (err) {
      setError(
        err.message || "Moderation action failed."
      );
    } finally {
      setModerationBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[.2em] text-[#d9a653]">
            Content
          </p>

          <h2 className="mt-2 font-[var(--font-display)] text-3xl">
            All videos
          </h2>

          <p className="mt-2 text-sm text-[#8b7c82]">
            Watch and moderate videos returned by
            the existing Admin API.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.025] px-4 py-2.5 text-[10px] uppercase tracking-[.12em] disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={
              loading ? "animate-spin" : ""
            }
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-[#e08a6b]/30 bg-[#e08a6b]/[0.07] p-4 text-sm text-[#e08a6b]">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3">
          <Search
            size={15}
            className="text-[#71656a]"
          />

          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search videos…"
            className="w-full bg-transparent py-3 text-xs outline-none placeholder:text-[#71656a]"
          />
        </div>

        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
          className="rounded-xl border border-white/[0.08] bg-[#171216] px-3 py-3 text-xs text-[#d9d0d2] outline-none"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[#d9a653]/25 bg-[#d9a653]/[0.06] px-4 py-3">
          <p className="text-xs text-[#d9a653]">
            {selectedIds.size} video
            {selectedIds.size === 1 ? "" : "s"}{" "}
            selected
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => bulkModerate("approve")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#d9a653] px-3 py-2 text-[9px] font-semibold uppercase tracking-[.08em] text-[#100d10] disabled:opacity-50"
            >
              <Check size={12} />
              Approve selected
            </button>

            <button
              onClick={() => bulkModerate("reject")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e08a6b]/30 px-3 py-2 text-[9px] uppercase tracking-[.08em] text-[#e08a6b] disabled:opacity-50"
            >
              <X size={12} />
              Reject selected
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkBusy}
              className="rounded-lg border border-white/[0.08] px-3 py-2 text-[9px] uppercase tracking-[.08em] text-[#b8acb0]"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-white/[0.07] text-[9px] uppercase tracking-[.14em] text-[#71656a]">
              <tr>
                <th className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={
                      filteredVideos.length > 0 &&
                      filteredVideos.every((v) =>
                        selectedIds.has(v._id)
                      )
                    }
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds(
                          new Set(
                            filteredVideos.map(
                              (v) => v._id
                            )
                          )
                        );
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </th>
                <th className="px-4 py-4">
                  Video
                </th>
                <th className="px-4 py-4">
                  Director
                </th>
                <th className="px-4 py-4">
                  Status
                </th>
                <th className="px-4 py-4">
                  Uploaded
                </th>
                <th className="px-4 py-4 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.06]">
              {loading ? (
                [1, 2, 3, 4].map((item) => (
                  <tr key={item}>
                    <td
                      colSpan="6"
                      className="px-4 py-4"
                    >
                      <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
                    </td>
                  </tr>
                ))
              ) : (
                filteredVideos.map((video) => {
                  const videoStatus =
                    video.moderationStatus ||
                    "unknown";

                  return (
                    <tr
                      key={video._id}
                      className="hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(
                            video._id
                          )}
                          onChange={() =>
                            toggleSelect(video._id)
                          }
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={
                                video.thumbnailUrl ||
                                ""
                              }
                              alt=""
                              className="h-14 w-24 rounded-lg bg-white/[0.04] object-cover"
                            />

                            <span className="absolute inset-0 grid place-items-center">
                              <span className="grid h-7 w-7 place-items-center rounded-full bg-black/65 text-[#d9a653]">
                                <Play
                                  size={12}
                                  fill="currentColor"
                                />
                              </span>
                            </span>
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-[300px] truncate text-xs text-[#e5dcde]">
                              {video.title ||
                                "Untitled video"}
                            </p>

                            <p className="mt-1 text-[9px] text-[#71656a]">
                              {video.language ||
                                "Language unavailable"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-[#a99da1]">
                        {video.directorId ||
                          "—"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[.08em] ${statusClass(
                            videoStatus
                          )}`}
                        >
                          {videoStatus}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-[#8b7c82]">
                        {video.uploadedAt
                          ? new Date(
                              video.uploadedAt
                            ).toLocaleDateString()
                          : "—"}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() =>
                              openVideo(video)
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-2 text-[9px] uppercase tracking-[.08em] text-[#b8acb0] hover:border-[#d9a653]/40"
                          >
                            <Eye size={12} />
                            Watch
                          </button>

                          <button
                            onClick={() =>
                              toggleFeatured(video)
                            }
                            disabled={featuredBusy}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[9px] uppercase tracking-[.08em] disabled:opacity-50 ${
                              video.isFeatured
                                ? "border-[#d9a653]/50 text-[#d9a653]"
                                : "border-white/[0.08] text-[#b8acb0]"
                            }`}
                          >
                            <Star
                              size={12}
                              fill={
                                video.isFeatured
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                            {video.isFeatured
                              ? "Featured"
                              : "Feature"}
                          </button>

                          {videoStatus ===
                            "pending" && (
                            <>
                              <button
                                onClick={() =>
                                  askModeration(
                                    "approve",
                                    video
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#d9a653] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[.08em] text-[#100d10]"
                              >
                                <Check size={12} />
                                Approve
                              </button>

                              <button
                                onClick={() =>
                                  askModeration(
                                    "reject",
                                    video
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#e08a6b]/25 px-2.5 py-2 text-[9px] uppercase tracking-[.08em] text-[#e08a6b]"
                              >
                                <X size={12} />
                                Reject
                              </button>
                            </>
                          )}

                          {videoStatus !==
                            "pending" && (
                            <button
                              onClick={() =>
                                askModeration(
                                  "reset",
                                  video
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-2 text-[9px] uppercase tracking-[.08em] text-[#b8acb0]"
                            >
                              <RotateCcw size={12} />
                              Reset
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading &&
          !filteredVideos.length && (
            <div className="p-12 text-center">
              <FilmEmpty />
            </div>
          )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={closeVideo}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#171216] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[.18em] text-[#d9a653]">
                  Admin player
                </p>

                <h3 className="mt-2 truncate font-[var(--font-display)] text-2xl text-[#efe7da]">
                  {selectedDetail?.title ||
                    selected.title ||
                    "Video"}
                </h3>
              </div>

              <button
                onClick={closeVideo}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-[#b8acb0]"
                aria-label="Close video"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              {watchLoading ? (
                <div className="grid aspect-video place-items-center rounded-2xl bg-black">
                  <div className="flex items-center gap-2 text-xs text-[#8b7c82]">
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                    Loading stream…
                  </div>
                </div>
              ) : watchData?.stream_url ? (
                <AdminVideoPlayer
                  src={watchData.stream_url}
                  poster={
                    selectedDetail?.thumbnailUrl ||
                    selected.thumbnailUrl
                  }
                  title={
                    selectedDetail?.title ||
                    selected.title
                  }
                />
              ) : (
                <div className="grid aspect-video place-items-center rounded-2xl bg-black">
                  <p className="text-sm text-[#8b7c82]">
                    No video stream was returned by
                    the backend.
                  </p>
                </div>
              )}

              {!detailLoading && (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Info
                    label="Status"
                    value={
                      selectedDetail?.moderationStatus ||
                      selected.moderationStatus ||
                      "—"
                    }
                  />

                  <Info
                    label="Language"
                    value={
                      selectedDetail?.language ||
                      selected.language ||
                      "—"
                    }
                  />

                  <Info
                    label="Uploaded"
                    value={
                      selectedDetail?.uploadedAt ||
                      selected.uploadedAt
                        ? new Date(
                            selectedDetail?.uploadedAt ||
                              selected.uploadedAt
                          ).toLocaleString()
                        : "—"
                    }
                  />
                </div>
              )}

              <div className="mt-4 rounded-xl bg-white/[0.03] p-4">
                <p className="text-[9px] uppercase tracking-[.12em] text-[#71656a]">
                  Description
                </p>

                <p className="mt-2 text-sm leading-relaxed text-[#b8acb0]">
                  {selectedDetail?.description ||
                    selected.description ||
                    "No description supplied."}
                </p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] uppercase tracking-[.12em] text-[#71656a]">
                      Age restriction
                    </p>

                    <AlertTriangle
                      size={14}
                      className="text-[#e08a6b]"
                    />
                  </div>

                  <button
                    disabled={ageBusy}
                    onClick={toggleAgeRestriction}
                    className={`mt-3 w-full rounded-lg border px-3 py-2 text-[9px] uppercase tracking-[.08em] disabled:opacity-50 ${
                      (selectedDetail?.ageRestricted ??
                        selected.ageRestricted)
                        ? "border-[#e08a6b]/40 text-[#e08a6b]"
                        : "border-white/[0.08] text-[#b8acb0]"
                    }`}
                  >
                    {(selectedDetail?.ageRestricted ??
                    selected.ageRestricted)
                      ? "Restricted — click to clear"
                      : "Not restricted — click to restrict"}
                  </button>
                </div>

                <div className="rounded-xl bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] uppercase tracking-[.12em] text-[#71656a]">
                      Featured
                    </p>

                    <Star
                      size={14}
                      className="text-[#d9a653]"
                    />
                  </div>

                  <button
                    disabled={featuredBusy}
                    onClick={() =>
                      toggleFeatured(
                        selectedDetail || selected
                      )
                    }
                    className={`mt-3 w-full rounded-lg border px-3 py-2 text-[9px] uppercase tracking-[.08em] disabled:opacity-50 ${
                      (selectedDetail?.isFeatured ??
                        selected.isFeatured)
                        ? "border-[#d9a653]/50 text-[#d9a653]"
                        : "border-white/[0.08] text-[#b8acb0]"
                    }`}
                  >
                    {(selectedDetail?.isFeatured ??
                    selected.isFeatured)
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
                  onChange={(event) =>
                    setContentWarningsText(
                      event.target.value
                    )
                  }
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

                  <StickyNote
                    size={14}
                    className="text-[#71656a]"
                  />
                </div>

                {notesLoading ? (
                  <p className="mt-3 text-xs text-[#71656a]">
                    Loading notes…
                  </p>
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
                            ? new Date(
                                note.addedAt
                              ).toLocaleString()
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#71656a]">
                    No internal notes yet — these are
                    never shown to the director.
                  </p>
                )}

                <textarea
                  value={noteText}
                  onChange={(event) =>
                    setNoteText(event.target.value)
                  }
                  rows={2}
                  placeholder="Add a private note visible only to admins…"
                  className="mt-3 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/40"
                />

                <button
                  disabled={
                    noteBusy || !noteText.trim()
                  }
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
                    {directorDetail.director
                      ?.username ||
                      "Unknown director"}
                  </p>

                  <p className="mt-1 text-[10px] text-[#71656a]">
                    Status:{" "}
                    {directorDetail.director
                      ?.accountStatus || "active"}{" "}
                    · {directorDetail.videoCount ?? 0}{" "}
                    video
                    {directorDetail.videoCount === 1
                      ? ""
                      : "s"}
                  </p>

                  {directorDetail.director
                    ?.accountStatus === "suspended" ? (
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

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {(selectedDetail?.moderationStatus ||
                  selected.moderationStatus) ===
                  "pending" && (
                  <>
                    <button
                      disabled={moderationBusy}
                      onClick={() =>
                        askModeration(
                          "reject",
                          selected
                        )
                      }
                      className="flex-1 rounded-xl border border-[#e08a6b]/30 px-4 py-3 text-[10px] uppercase tracking-[.1em] text-[#e08a6b] disabled:opacity-50"
                    >
                      <X
                        size={14}
                        className="mr-1 inline"
                      />
                      Reject
                    </button>

                    <button
                      disabled={moderationBusy}
                      onClick={() =>
                        askModeration(
                          "approve",
                          selected
                        )
                      }
                      className="flex-1 rounded-xl bg-[#d9a653] px-4 py-3 text-[10px] font-semibold uppercase tracking-[.1em] text-[#100d10] disabled:opacity-50"
                    >
                      <Check
                        size={14}
                        className="mr-1 inline"
                      />
                      Approve
                    </button>
                  </>
                )}

                {(selectedDetail?.moderationStatus ||
                  selected.moderationStatus) !==
                  "pending" && (
                  <button
                    disabled={moderationBusy}
                    onClick={() =>
                      askModeration(
                        "reset",
                        selected
                      )
                    }
                    className="flex-1 rounded-xl border border-white/[0.09] px-4 py-3 text-[10px] uppercase tracking-[.1em] text-[#b8acb0] disabled:opacity-50"
                  >
                    <RotateCcw
                      size={14}
                      className="mr-1 inline"
                    />
                    Return to review
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {action && (
        <ModerationDialog
          action={action}
          text={moderationText}
          setText={setModerationText}
          busy={moderationBusy}
          onConfirm={moderateVideo}
          onCancel={() => {
            if (!moderationBusy) {
              setAction(null);
              setModerationText("");
            }
          }}
        />
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

      <p className="mt-1 text-xs text-[#d9d0d2]">
        {value}
      </p>
    </div>
  );
}

function FilmEmpty() {
  return (
    <div>
      <p className="text-sm text-[#71656a]">
        No videos match the current search or
        status filter.
      </p>

      <p className="mt-2 text-[10px] text-[#51494d]">
        The list uses the real GET /admin/videos
        response.
      </p>
    </div>
  );
}

function ModerationDialog({
  action,
  text,
  setText,
  busy,
  onConfirm,
  onCancel,
}) {
  const isApprove =
    action.kind === "approve";

  const isReject =
    action.kind === "reject" ||
    action.kind === "bulk-reject";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        onClick={(event) =>
          event.stopPropagation()
        }
        className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#171216] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] uppercase tracking-[.18em] text-[#d9a653]">
              Moderation
            </p>

            <h3 className="mt-2 font-[var(--font-display)] text-xl">
              {isApprove
                ? "Approve video"
                : action.kind === "bulk-reject"
                ? "Reject selected videos"
                : isReject
                ? "Reject video"
                : "Reset video"}
            </h3>
          </div>

          <button
            onClick={onCancel}
            disabled={busy}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04]"
          >
            <X size={15} />
          </button>
        </div>

        <p className="mt-3 text-sm text-[#8b7c82]">
          {action.kind === "bulk-reject"
            ? `${action.count} selected video${
                action.count === 1 ? "" : "s"
              }`
            : action.video?.title ||
              "Selected video"}
        </p>

        {isApprove && (
          <textarea
            value={text}
            onChange={(event) =>
              setText(event.target.value)
            }
            maxLength={500}
            rows={4}
            placeholder="Optional approval note…"
            className="mt-4 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/40"
          />
        )}

        {isReject && (
          <textarea
            value={text}
            onChange={(event) =>
              setText(event.target.value)
            }
            maxLength={500}
            rows={4}
            placeholder="Enter rejection reason…"
            className="mt-4 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-[#efe7da] outline-none focus:border-[#e08a6b]/40"
          />
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-[10px] uppercase tracking-[.1em] text-[#b8acb0]"
          >
            Cancel
          </button>

          <button
            disabled={
              busy ||
              (isReject &&
                text.trim().length < 3)
            }
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[.1em] disabled:opacity-40 ${
              isReject
                ? "bg-[#e08a6b] text-[#100d10]"
                : "bg-[#d9a653] text-[#100d10]"
            }`}
          >
            {busy
              ? "Processing…"
              : isApprove
              ? "Approve"
              : isReject
              ? "Reject"
              : "Reset"}
          </button>
        </div>
      </div>
    </div>
  );
}