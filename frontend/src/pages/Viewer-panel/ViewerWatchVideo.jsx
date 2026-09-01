import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Plyr from "plyr";
import Hls from "hls.js";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Edit3,
  MessageCircle,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";

import "plyr/dist/plyr.css";

import ViewerNav from "../../components/ViewerNav.jsx";
import {
  deleteRequest,
  getRequest,
  postJson,
  putJson,
} from "../../api/client.js";

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function CommentItem({
  comment,
  videoId,
  currentViewerId,
  onChanged,
  depth = 0,
}) {
  const [replies, setReplies] = useState([]);
  const [showReplies, setShowReplies] = useState(false);
  const [reply, setReply] = useState("");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isOwner = comment.viewerId === currentViewerId;

  async function loadReplies() {
    try {
      const data = await getRequest(
        `/viewer/videos/${videoId}/comments/${comment.id}/replies?limit=100`
      );

      setReplies(data.replies || []);
      setShowReplies(true);
    } catch (err) {
      setError(err.message || "Unable to load replies.");
    }
  }

  async function sendReply() {
    if (!reply.trim()) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await postJson(
        `/viewer/videos/${videoId}/comments/${comment.id}/reply`,
        { text: reply.trim() }
      );

      setReply("");
      await loadReplies();
      onChanged();
    } catch (err) {
      setError(err.message || "Unable to post reply.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!text.trim()) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await putJson(
        `/viewer/videos/${videoId}/comments/${comment.id}`,
        { text: text.trim() }
      );

      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err.message || "Unable to edit comment.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment() {
    const confirmed = window.confirm(
      "Delete this comment and its replies?"
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await deleteRequest(
        `/viewer/videos/${videoId}/comments/${comment.id}`
      );

      onChanged();
    } catch (err) {
      setError(err.message || "Unable to delete comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`
        border-l
        ${
          depth > 0
            ? "ml-5 border-white/10 pl-4"
            : "border-transparent"
        }
      `}
    >
      <div className="py-4">
        <div className="flex gap-3">
          <div
            className="
              grid h-9 w-9 shrink-0 place-items-center
              overflow-hidden rounded-full
              bg-(--velvet)
              font-(--font-mono)
              text-xs text-(--gold-soft)
            "
          >
            {comment.viewerAvatarUrl ? (
              <img
                src={comment.viewerAvatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              comment.viewerUsername?.charAt(0)?.toUpperCase()
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-sm">{comment.viewerUsername}</b>

              <span
                className="
                  font-(--font-mono)
                  text-[0.56rem]
                  uppercase
                  text-(--mauve)
                "
              >
                ID {comment.viewerId}
              </span>
            </div>

            {editing ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={1000}
                  className="
                    min-w-0 flex-1
                    border border-white/10
                    bg-transparent
                    px-3 py-2
                    text-sm
                    text-(--parchment)
                    outline-none
                    focus:border-(--gold)
                  "
                />

                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={busy}
                  className="text-(--gold-soft) hover:text-(--gold)"
                  aria-label="Save edit"
                >
                  <Check size={17} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setText(comment.text);
                  }}
                  className="text-(--mauve) hover:text-(--parchment)"
                  aria-label="Cancel edit"
                >
                  <X size={17} />
                </button>
              </div>
            ) : (
              <p
                className="
                  mt-2 whitespace-pre-wrap
                  text-sm leading-6
                  text-(--parchment)
                "
              >
                {comment.text}
              </p>
            )}

            <div
              className="
                mt-2 flex flex-wrap items-center gap-3
                font-(--font-mono)
                text-[0.56rem]
                uppercase
                text-(--mauve)
              "
            >
              <button
                type="button"
                onClick={() => {
                  if (!showReplies) {
                    loadReplies();
                  } else {
                    setShowReplies(false);
                  }
                }}
                className="transition-colors hover:text-(--parchment)"
              >
                {showReplies ? "Hide replies" : "Reply"}

                {comment.replyIds?.length
                  ? ` (${comment.replyIds.length})`
                  : ""}
              </button>

              {isOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="
                      inline-flex items-center gap-1
                      transition-colors
                      hover:text-(--gold-soft)
                    "
                  >
                    <Edit3 size={12} />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={deleteComment}
                    disabled={busy}
                    className="
                      inline-flex items-center gap-1
                      transition-colors
                      hover:text-(--error)
                    "
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </>
              )}
            </div>

            {showReplies && (
              <div className="mt-2">
                {replies.map((replyComment) => (
                  <CommentItem
                    key={replyComment.id}
                    comment={replyComment}
                    videoId={videoId}
                    currentViewerId={currentViewerId}
                    onChanged={loadReplies}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}

            {showReplies && (
              <div className="mt-3 flex gap-2">
                <input
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Write a reply…"
                  maxLength={1000}
                  className="
                    min-w-0 flex-1
                    border border-white/10
                    bg-transparent
                    px-3 py-2
                    text-sm
                    text-(--parchment)
                    outline-none
                    placeholder:text-(--mauve)
                    focus:border-(--gold)
                  "
                />

                <button
                  type="button"
                  onClick={sendReply}
                  disabled={busy || !reply.trim()}
                  className="
                    rounded-[3px]
                    bg-(--gold)
                    px-3
                    text-(--stage)
                    transition-opacity
                    hover:opacity-90
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                  aria-label="Send reply"
                >
                  <Send size={15} />
                </button>
              </div>
            )}

            {error && (
              <p className="mt-2 text-xs text-(--error)">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ViewerWatchVideo() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [video, setVideo] = useState(null);
  const [stream, setStream] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [watching, setWatching] = useState(false);

  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hlsRef = useRef(null);
  const heartbeatRef = useRef(null);

  const auth = JSON.parse(
    localStorage.getItem("proscenium_auth") || "null"
  );

  const viewerId = auth?.userId;

  async function loadComments() {
    try {
      const data = await getRequest(
        `/viewer/videos/${id}/comments?limit=100`
      );

      setComments(data.comments || []);
    } catch (err) {
      setError(err.message || "Unable to load comments.");
    }
  }

  async function loadVideo() {
    setLoading(true);
    setError("");

    try {
      const [videoData, commentsData, watchData] = await Promise.all([
        getRequest(`/viewer/videos/${id}`),
        getRequest(`/viewer/videos/${id}/comments?limit=100`),
        getRequest(`/viewer/videos/${id}/watch`),
      ]);

      setVideo(videoData);
      setComments(commentsData.comments || []);
      setStream(watchData);
    } catch (err) {
      setError(err.message || "Unable to load this film.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVideo();

    return () => {
      clearInterval(heartbeatRef.current);
      playerRef.current?.destroy();
      hlsRef.current?.destroy();
    };
  }, [id]);

  useEffect(() => {
    if (!stream?.stream_url || !videoRef.current) {
      return;
    }

    const videoElement = videoRef.current;
    let plyrInstance;
    let hlsInstance;

    const playerOptions = {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "mute",
        "volume",
        "settings",
        "fullscreen",
      ],
      settings: ["speed"],
    };

    function attachPlayerEvents(player) {
      player.on("play", () => setWatching(true));
      player.on("pause", () => setWatching(false));
      player.on("ended", () => setWatching(false));
    }

    function resumePlayback(player) {
      const resumeTime = Number(stream.resumeTimeSec || 0);
      const duration = Number(video?.durationSec || 0);

      player.once("ready", () => {
        if (
          resumeTime > 5 &&
          (!duration || resumeTime < duration - 5)
        ) {
          player.currentTime = resumeTime;
        }
      });
    }

    if (Hls.isSupported()) {
      hlsInstance = new Hls();
      hlsRef.current = hlsInstance;

      hlsInstance.attachMedia(videoElement);

      hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
        hlsInstance.loadSource(stream.stream_url);
      });

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        const qualities = hlsInstance.levels
          .map((level) => level.height)
          .filter(Boolean)
          .sort((a, b) => a - b);

        const options = {
          ...playerOptions,
          settings: ["quality", "speed"],
        };

        if (qualities.length > 0) {
          options.quality = {
            default: qualities.at(-1),
            options: qualities,
            forced: true,
            onChange: (quality) => {
              const level = hlsInstance.levels.findIndex(
                (item) => item.height === quality
              );

              if (level >= 0) {
                hlsInstance.currentLevel = level;
              }
            },
          };
        }

        plyrInstance = new Plyr(videoElement, options);
        playerRef.current = plyrInstance;

        resumePlayback(plyrInstance);
        attachPlayerEvents(plyrInstance);
      });

      hlsInstance.on(Hls.Events.ERROR, (_, details) => {
        if (details.fatal) {
          setError(
            "Playback error — the stream failed to load."
          );
        }
      });
    } else if (
      videoElement.canPlayType("application/vnd.apple.mpegurl")
    ) {
      videoElement.src = stream.stream_url;

      plyrInstance = new Plyr(videoElement, playerOptions);
      playerRef.current = plyrInstance;

      resumePlayback(plyrInstance);
      attachPlayerEvents(plyrInstance);
    }

    return () => {
      hlsInstance?.destroy();
      plyrInstance?.destroy();

      if (playerRef.current === plyrInstance) {
        playerRef.current = null;
      }

      if (hlsRef.current === hlsInstance) {
        hlsRef.current = null;
      }
    };
  }, [stream?.stream_url, video?.durationSec]);

  useEffect(() => {
    if (!watching) {
      return;
    }

    heartbeatRef.current = setInterval(() => {
      const currentTime = playerRef.current?.currentTime;

      if (typeof currentTime !== "number") {
        return;
      }

      postJson(`/viewer/videos/${id}/heartbeat`, {
        currentTimeSec: currentTime,
      }).catch(() => {});
    }, 5000);

    return () => {
      clearInterval(heartbeatRef.current);
    };
  }, [watching, id]);

  async function react(type) {
    try {
      const data = await postJson(`/viewer/videos/${id}/react`, {
        type,
      });

      setVideo((current) => ({
        ...current,
        reaction: data.reaction,
        likes: data.likes,
        dislikes: data.dislikes,
      }));
    } catch (err) {
      setError(err.message || "Unable to update reaction.");
    }
  }

  async function toggleWatchlist() {
    if (!video) {
      return;
    }

    try {
      const data = await postJson(
        `/viewer/videos/${id}/watchlist`,
        {
          saved: !video.saved,
        }
      );

      setVideo((current) => ({
        ...current,
        saved: data.saved,
      }));
    } catch (err) {
      setError(err.message || "Unable to update watchlist.");
    }
  }

  async function postComment() {
    if (!comment.trim()) {
      return;
    }

    setPosting(true);
    setError("");

    try {
      await postJson(`/viewer/videos/${id}/comments`, {
        text: comment.trim(),
      });

      setComment("");
      await loadComments();
    } catch (err) {
      setError(err.message || "Unable to post comment.");
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-(--stage) p-10 text-(--mauve)">
        Loading film…
      </div>
    );
  }

  if (error && !video) {
    return (
      <div className="min-h-screen bg-(--stage) p-10 text-(--error)">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--stage) text-(--parchment)">
      <ViewerNav />

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="
            mb-5 flex items-center gap-2
            font-(--font-mono)
            text-[0.62rem]
            uppercase
            text-(--mauve)
            transition-colors
            hover:text-(--parchment)
          "
        >
          <ArrowLeft size={15} />
          Back
        </button>

        {error && (
          <div
            className="
              mb-5
              border border-(--error)/40
              px-4 py-3
              text-sm text-(--error)
            "
          >
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section>
            <div
              className="
                overflow-hidden
                rounded-[3px]
                border border-white/10
                bg-black
              "
            >
              <video
                ref={videoRef}
                title={video.title}
                playsInline
              />
            </div>

            <div className="mt-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1
                    className="
                      font-(--font-display)
                      text-3xl
                      lg:text-4xl
                    "
                  >
                    {video.title}
                  </h1>

                  <div
                    className="
                      mt-2 flex flex-wrap gap-3
                      font-(--font-mono)
                      text-[0.58rem]
                      uppercase
                      text-(--mauve)
                    "
                  >
                    <span>{video.releaseYear || ""}</span>
                    <span>{video.language || ""}</span>
                    <span>{video.views || 0} views</span>
                    <span>
                      {formatDuration(video.durationSec)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleWatchlist}
                  className={`
                    flex items-center gap-2
                    rounded-[3px]
                    border
                    px-3 py-2
                    font-(--font-mono)
                    text-[0.6rem]
                    uppercase
                    transition-colors
                    ${
                      video.saved
                        ? "border-(--gold) text-(--gold-soft)"
                        : "border-white/10 text-(--mauve) hover:border-(--gold) hover:text-(--parchment)"
                    }
                  `}
                >
                  <Bookmark size={15} />
                  {video.saved ? "Saved" : "Save"}
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => react("like")}
                  className={`
                    flex items-center gap-2
                    rounded-[3px]
                    border
                    px-3 py-2
                    text-sm
                    transition-colors
                    ${
                      video.reaction === "like"
                        ? "border-(--gold) text-(--gold-soft)"
                        : "border-white/10 text-(--mauve) hover:border-(--gold)"
                    }
                  `}
                >
                  <ThumbsUp size={16} />
                  {video.likes || 0}
                </button>

                <button
                  type="button"
                  onClick={() => react("dislike")}
                  className={`
                    flex items-center gap-2
                    rounded-[3px]
                    border
                    px-3 py-2
                    text-sm
                    transition-colors
                    ${
                      video.reaction === "dislike"
                        ? "border-(--gold) text-(--gold-soft)"
                        : "border-white/10 text-(--mauve) hover:border-(--gold)"
                    }
                  `}
                >
                  <ThumbsDown size={16} />
                  {video.dislikes || 0}
                </button>
              </div>

              {video.description && (
                <p className="mt-5 max-w-3xl text-sm leading-7 text-(--mauve)">
                  {video.description}
                </p>
              )}

              {video.genres?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {video.genres.map((genre) => (
                    <span
                      key={genre}
                      className="
                        rounded-full
                        border border-white/10
                        px-3 py-1
                        font-(--font-mono)
                        text-[0.58rem]
                        uppercase
                        text-(--mauve)
                      "
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside
            className="
              rounded-[3px]
              border border-white/10
              bg-[#17131a]
              p-5
            "
          >
            <p
              className="
                font-(--font-mono)
                text-[0.6rem]
                uppercase
                tracking-[0.12em]
                text-(--gold)
              "
            >
              Film notes
            </p>

            {video.contentWarnings?.length > 0 && (
              <div
                className="
                  mt-4
                  border-l-2 border-(--error)
                  pl-3
                  text-xs text-(--error)
                "
              >
                {video.contentWarnings.join(" · ")}
              </div>
            )}

            <div className="mt-5 space-y-4 text-sm">
              <div>
                <span className="text-(--mauve)">
                  Production
                </span>
                <p>{video.productionCountry || "—"}</p>
              </div>

              <div>
                <span className="text-(--mauve)">
                  Rating
                </span>
                <p>
                  {video.avgRating ?? 0} ·{" "}
                  {video.reviewCount ?? 0} reviews
                </p>
              </div>

              <div>
                <span className="text-(--mauve)">
                  Unique viewers
                </span>
                <p>{video.uniqueViews ?? 0}</p>
              </div>
            </div>

            {video.cast?.length > 0 && (
              <div className="mt-7">
                <p
                  className="
                    mb-3
                    font-(--font-mono)
                    text-[0.6rem]
                    uppercase
                    text-(--gold)
                  "
                >
                  Cast
                </p>

                <div className="space-y-3">
                  {video.cast.map((castMember, index) => (
                    <div
                      key={castMember.id || index}
                      className="flex items-center gap-3"
                    >
                      {castMember.photoUrl ? (
                        <img
                          src={castMember.photoUrl}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="
                            h-9 w-9
                            rounded-full
                            bg-(--velvet)
                          "
                        />
                      )}

                      <div>
                        <p className="text-sm">
                          {castMember.name || "Cast member"}
                        </p>

                        <p className="text-xs text-(--mauve)">
                          {castMember.characterName || ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        <section className="mt-12 max-w-4xl">
          <div className="mb-5 flex items-center gap-2">
            <MessageCircle
              size={18}
              className="text-(--gold)"
            />

            <h2 className="font-(--font-display) text-2xl">
              Comments
            </h2>

            <span
              className="
                font-(--font-mono)
                text-[0.6rem]
                text-(--mauve)
              "
            >
              {video.commentCount || comments.length}
            </span>
          </div>

          <div className="mb-6 flex gap-2">
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Share your thoughts…"
              className="
                min-w-0 flex-1
                resize-none
                border border-white/10
                bg-[#17131a]
                px-4 py-3
                text-sm text-(--parchment)
                outline-none
                placeholder:text-(--mauve)
                focus:border-(--gold)
              "
            />

            <button
              type="button"
              onClick={postComment}
              disabled={posting || !comment.trim()}
              className="
                self-end
                rounded-[3px]
                bg-(--gold)
                p-3
                text-(--stage)
                transition-opacity
                hover:opacity-90
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
              aria-label="Post comment"
            >
              <Send size={17} />
            </button>
          </div>

          {comments.length === 0 ? (
            <div
              className="
                border border-dashed border-white/10
                p-10
                text-center
                text-sm
                text-(--mauve)
              "
            >
              No comments yet. Be the first.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {comments.map((commentItem) => (
                <CommentItem
                  key={commentItem.id}
                  comment={commentItem}
                  videoId={id}
                  currentViewerId={viewerId}
                  onChanged={loadComments}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}