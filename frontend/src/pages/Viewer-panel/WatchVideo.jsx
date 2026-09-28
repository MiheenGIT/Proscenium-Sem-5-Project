import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import Plyr from "plyr";
import Hls from "hls.js";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Edit3,
  Heart,
  MessageCircle,
  Play,
  Send,
  Share2,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
  Film,
} from "lucide-react";

import WatchSidePanel from "./Watch/WatchSidePanel.jsx";
import "plyr/dist/plyr.css";
import "./WatchVideo.css";

import {
  deleteRequest,
  getRequest,
  postJson,
  putJson,
} from "../../api/client.js";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

const duration = (seconds) => {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

function RecThumbnail({ rec }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [rec?.thumbnailUrl]);

  if (!rec?.thumbnailUrl || failed) {
    return (
      <div className="rec-fallback">
        <div className="rec-fallback-icon">
          <Play size={14} fill="currentColor" />
        </div>
        <span className="rec-fallback-brand">Proscenium</span>
      </div>
    );
  }

  return (
    <img
      src={rec.thumbnailUrl}
      alt={rec.title || "Film"}
      onError={() => setFailed(true)}
      className="rec-img"
    />
  );
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [likes, setLikes] = useState(Number(comment.likes || 0));
  const [dislikes, setDislikes] = useState(Number(comment.dislikes || 0));
  const [reaction, setReaction] = useState(comment.reaction || null);

  const owner = comment.viewerId === currentViewerId;

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
    if (!reply.trim()) return;
    setBusy(true);

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

  async function react(type) {
    try {
      const data = await postJson(
        `/viewer/videos/${videoId}/comments/${comment.id}/react`,
        { type }
      );
      setLikes(Number(data.likes || 0));
      setDislikes(Number(data.dislikes || 0));
      setReaction(data.reaction || null);
    } catch (err) {
      setError(err.message || "Unable to update comment reaction.");
    }
  }

  async function edit() {
    if (!text.trim()) return;
    setBusy(true);

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

  async function remove() {
    setConfirmDelete(false);
    setBusy(true);

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
    <div className={depth ? "comment reply" : "comment"}>
      <div className="avatar">
        {comment.viewerAvatarUrl ? (
          <img src={comment.viewerAvatarUrl} alt="" />
        ) : (
          comment.viewerUsername?.charAt(0)?.toUpperCase()
        )}
      </div>

      <div className="comment-body">
        <div className="comment-head">
          <b>{comment.viewerUsername}</b>
          {comment.createdAt && (
            <span className="comment-time">
              {new Date(comment.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>

        {editing ? (
          <div className="edit-row">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
            />
            <button onClick={edit} disabled={busy}>
              <Check size={14} />
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setText(comment.text);
              }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <p>{comment.text}</p>
        )}

        <div className="comment-actions">
          <button
            className={reaction === "like" ? "selected" : ""}
            onClick={() => react("like")}
          >
            <ThumbsUp size={12} />
            {likes > 0 && <span>{likes}</span>}
          </button>

          <button
            className={reaction === "dislike" ? "selected" : ""}
            onClick={() => react("dislike")}
          >
            <ThumbsDown size={12} />
            {dislikes > 0 && <span>{dislikes}</span>}
          </button>

          <button
            onClick={() =>
              showReplies ? setShowReplies(false) : loadReplies()
            }
          >
            Reply
            {comment.replyIds?.length
              ? ` (${comment.replyIds.length})`
              : ""}
          </button>

          {owner && (
            <>
              <button onClick={() => setEditing(true)}>
                <Edit3 size={12} />
                Edit
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                <Trash2 size={12} />
                Delete
              </button>
            </>
          )}
        </div>

        <ConfirmDialog
          open={confirmDelete}
          title="Delete Comment"
          message="Are you sure you want to delete this comment and its replies?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          danger={true}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />

        {showReplies && (
          <div className="replies-wrapper">
            {replies.map((item) => (
              <CommentItem
                key={item.id}
                comment={item}
                videoId={videoId}
                currentViewerId={currentViewerId}
                onChanged={loadReplies}
                depth={depth + 1}
              />
            ))}
          </div>
        )}

        {showReplies && (
          <div className="reply-box">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply…"
              maxLength={1000}
            />
            <button
              onClick={sendReply}
              disabled={busy || !reply.trim()}
            >
              <Send size={14} />
            </button>
          </div>
        )}

        {error && <small className="watch-error">{error}</small>}
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
  const [reviews, setReviews] = useState([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [watching, setWatching] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [showRecs, setShowRecs] = useState(false);
  const [dismissedRecs, setDismissedRecs] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState("discussion");

  const [plyrContainer, setPlyrContainer] = useState(null);

  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hlsRef = useRef(null);
  const heartbeatRef = useRef(null);
  const lastSavedTimeRef = useRef(-1);
  const resumeAppliedRef = useRef(false);
  const mediaReadyRef = useRef(false);
  // Mirrors `dismissedRecs` so the "pause" handler (bound once, inside the
  // player-setup useEffect below) can read the latest value without that
  // effect needing to depend on `dismissedRecs` and rebuild the player.
  const dismissedRecsRef = useRef(false);

  const auth = JSON.parse(
    localStorage.getItem("proscenium_auth") || "null"
  );
  const viewerId = auth?.userId;

  // Keep the ref in sync with state so the pause handler can read the latest value
  // without causing the player-setup effect to depend on dismissedRecs
  useEffect(() => {
    dismissedRecsRef.current = dismissedRecs;
  }, [dismissedRecs]);

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

  async function loadRecommendations() {
    try {
      const data = await getRequest(
        `/viewer/videos?limit=4&excludeId=${id}`
      );
      setRecommendations(data.videos || []);
    } catch {
      setRecommendations([]);
    }
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [videoData, commentsData, watchData, reviewsData] =
        await Promise.all([
          getRequest(`/viewer/videos/${id}`),
          getRequest(`/viewer/videos/${id}/comments?limit=100`),
          getRequest(`/viewer/videos/${id}/watch`),
          getRequest(`/viewer/videos/${id}/reviews`),
        ]);

      setVideo(videoData);
      setComments(commentsData.comments || []);
      setStream(watchData);
      setReviews(reviewsData.reviews || []);

      loadRecommendations();
    } catch (err) {
      setError(err.message || "Unable to load this film.");
    } finally {
      setLoading(false);
    }
  }

  const resumeStorageKey = `proscenium_resume_${viewerId || "viewer"}_${id}`;

  const getCurrentPlaybackTime = () => {
    const currentTime = playerRef.current?.currentTime ?? videoRef.current?.currentTime;
    return Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : null;
  };

  const saveLocalResume = (currentTime) => {
    if (!Number.isFinite(currentTime) || currentTime < 0) return;
    try {
      localStorage.setItem(
        resumeStorageKey,
        JSON.stringify({ currentTimeSec: currentTime, savedAt: Date.now() })
      );
    } catch {}
  };

  const clearLocalResume = () => {
    try {
      localStorage.removeItem(resumeStorageKey);
    } catch {}
  };

  const savePlaybackPosition = async (currentTime, { keepalive = false } = {}) => {
    if (!Number.isFinite(currentTime) || currentTime < 0) return;

    saveLocalResume(currentTime);
    lastSavedTimeRef.current = currentTime;

    const body = JSON.stringify({ currentTimeSec: currentTime });

    if (keepalive) {
      try {
        const raw = localStorage.getItem("proscenium_auth");
        const storedAuth = raw ? JSON.parse(raw) : null;
        const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

        fetch(`${apiBase}/viewer/videos/${id}/heartbeat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(storedAuth?.token
              ? { Authorization: `Bearer ${storedAuth.token}` }
              : {}),
          },
          body,
          keepalive: true,
        }).catch(() => {});
        return;
      } catch {}
    }

    try {
      await postJson(`/viewer/videos/${id}/heartbeat`, {
        currentTimeSec: currentTime,
      });
    } catch {}
  };

  // Load video data and save the last playback position when leaving the page.
  useEffect(() => {
    load();

    const saveBeforeLeave = () => {
      const currentTime = getCurrentPlaybackTime();
      if (currentTime !== null) savePlaybackPosition(currentTime, { keepalive: true });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") saveBeforeLeave();
    };

    window.addEventListener("pagehide", saveBeforeLeave);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      saveBeforeLeave();
      window.removeEventListener("pagehide", saveBeforeLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(heartbeatRef.current);
      playerRef.current?.destroy();
      hlsRef.current?.destroy();
      playerRef.current = null;
      hlsRef.current = null;
      setPlyrContainer(null);
      setShowRecs(false);
      setDismissedRecs(false);
    };
  }, [id, viewerId]);

  useEffect(() => {
    if (!stream?.stream_url || !videoRef.current) {
      return;
    }

    const element = videoRef.current;
    let plyr;
    let hls;

    resumeAppliedRef.current = false;
    mediaReadyRef.current = false;

    const baseOptions = {
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

    const setupPlayer = (player) => {
      player.once("ready", () => {
        setPlyrContainer(player.elements.container);
      });

      const applyResumePosition = () => {
        if (resumeAppliedRef.current || !element.duration || !Number.isFinite(element.duration)) {
          return;
        }

        const serverResume = Number(stream.resumeTimeSec || 0);
        let localResume = 0;
        try {
          const stored = JSON.parse(localStorage.getItem(resumeStorageKey) || "null");
          localResume = Number(stored?.currentTimeSec || 0);
        } catch {}

        // Prefer the newest/largest known checkpoint so a failed final server
        // request cannot move the viewer backwards.
        const resume = Math.max(serverResume, localResume);
        const total = Number(element.duration || video?.durationSec || 0);

        if (resume > 5 && resume < total - 5) {
          try {
            element.currentTime = resume;
            player.currentTime = resume;
            resumeAppliedRef.current = true;
          } catch {}
        } else if (resume <= 5 || resume >= total - 5) {
          resumeAppliedRef.current = true;
        }

        mediaReadyRef.current = true;
      };

      element.addEventListener("loadedmetadata", applyResumePosition, { once: true });
      if (element.readyState >= 1) applyResumePosition();

      player.on("loadedmetadata", applyResumePosition);
      player.on("canplay", applyResumePosition);

      player.on("play", () => {
        setWatching(true);
        setShowRecs(false);
        setDismissedRecs(false);
      });

      player.on("pause", () => {
        setWatching(false);
        if (!dismissedRecsRef.current) {
          setShowRecs(true);
        }
        // Save the exact paused position immediately.
        const currentTime = getCurrentPlaybackTime();
        if (currentTime !== null) savePlaybackPosition(currentTime);
      });

      player.on("timeupdate", () => {
        if (mediaReadyRef.current) {
          const currentTime = getCurrentPlaybackTime();
          if (currentTime !== null) saveLocalResume(currentTime);
        }
      });

      player.on("seeking", () => {
        const currentTime = getCurrentPlaybackTime();
        if (currentTime !== null) saveLocalResume(currentTime);
      });

      player.on("seeked", () => {
        const currentTime = getCurrentPlaybackTime();
        if (currentTime !== null) savePlaybackPosition(currentTime);
      });

      player.on("ended", () => {
        setWatching(false);
        setShowRecs(true);
        setDismissedRecs(false);
        clearLocalResume();
        savePlaybackPosition(Number(element.duration || video?.durationSec || 0));
      });
    };

    if (Hls.isSupported()) {
      hls = new Hls();
      hlsRef.current = hls;
      hls.attachMedia(element);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(stream.stream_url);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const qualities = hls.levels
          .map((level) => level.height)
          .filter(Boolean)
          .sort((a, b) => a - b);

        const options = {
          ...baseOptions,
          settings: ["quality", "speed"],
        };

        if (qualities.length) {
          options.quality = {
            default: qualities[qualities.length - 1],
            options: qualities,
            forced: true,
            onChange: (quality) => {
              const level = hls.levels.findIndex(
                (item) => item.height === quality
              );
              if (level >= 0) {
                hls.currentLevel = level;
              }
            },
          };
        }

        plyr = new Plyr(element, options);
        playerRef.current = plyr;
        setupPlayer(plyr);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setError("Playback error — the stream failed to load.");
        }
      });
    } else if (element.canPlayType("application/vnd.apple.mpegurl")) {
      element.src = stream.stream_url;
      plyr = new Plyr(element, baseOptions);
      playerRef.current = plyr;
      setupPlayer(plyr);
    }

    return () => {
      hls?.destroy();
      plyr?.destroy();
    };
  }, [stream?.stream_url, stream?.resumeTimeSec, video?.durationSec]);

  useEffect(() => {
    if (!watching) return;

    heartbeatRef.current = setInterval(() => {
      const currentTime = getCurrentPlaybackTime();
      if (currentTime !== null) savePlaybackPosition(currentTime);
    }, 5000);

    return () => clearInterval(heartbeatRef.current);
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

  async function save() {
    try {
      const data = await postJson(`/viewer/videos/${id}/watchlist`, {
        saved: !video.saved,
      });

      setVideo((current) => ({
        ...current,
        saved: data.saved,
      }));
    } catch (err) {
      setError(err.message || "Unable to update watchlist.");
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  async function postComment() {
    if (!comment.trim()) return;
    setPosting(true);

    try {
      await postJson(`/viewer/videos/${id}/comments`, {
        text: comment.trim(),
      });
      setComment("");
      await loadComments();
      setVideo((current) => ({
        ...current,
        commentCount: Number(current.commentCount || 0) + 1,
      }));
    } catch (err) {
      setError(err.message || "Unable to post comment.");
    } finally {
      setPosting(false);
    }
  }

  async function toggleReviewLike(reviewId) {
    try {
      const data = await postJson(
        `/viewer/videos/${id}/reviews/${reviewId}/like`,
        {}
      );

      setReviews((current) =>
        current.map((item) =>
          item.id === reviewId
            ? { ...item, likes: data.likes, liked: data.liked }
            : item
        )
      );
    } catch (err) {
      setError(err.message || "Unable to update like.");
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="watch-page">
          <div className="watch-loading">
            <div className="loading-spinner" />
            <span>Loading film…</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!video) {
    return (
      <DashboardLayout>
        <div className="watch-page">
          <div className="watch-loading watch-error">
            {error || "Film not found."}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="watch-page">
        <main className="watch-main">
          {/* Top Navigation */}
          <div className="watch-top-bar">
            <button className="back-button" onClick={() => navigate(-1)}>
              <ArrowLeft size={14} />
              <span>Back to Browse</span>
            </button>
          </div>

          {error && (
            <div className="watch-alert">
              <span>{error}</span>
              <button onClick={() => setError("")}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Hero Player & Side Card Layout */}
          <section className="watch-hero">
            <div className="watch-hero-grid">
              <div className="watch-player-col">
                <div className="watch-player">
                  <video
                    ref={videoRef}
                    title={video.title}
                    playsInline
                  />

                  {/* YouTube-Style In-Player Recommendations Dock */}
                  {plyrContainer &&
                    showRecs &&
                    recommendations.length > 0 &&
                    createPortal(
                      <div className="rec-overlay-dock">
                        <div className="rec-dock-header">
                          <div className="flex items-center gap-1.5">
                            <Sparkles size={12} className="text-[#d9a653]" />
                            <span className="rec-dock-title">
                              More to Watch
                            </span>
                          </div>
                          <button
                            type="button"
                            className="rec-dock-close"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowRecs(false);
                              setDismissedRecs(true);
                            }}
                            title="Close suggestions"
                          >
                            <X size={13} />
                          </button>
                        </div>

                        <div className="rec-dock-shelf">
                          {recommendations.slice(0, 4).map((rec) => (
                            <div
                              key={rec.id}
                              className="rec-dock-card"
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/viewer/videos/${rec.id}`);
                              }}
                            >
                              <div className="rec-dock-thumb">
                                <RecThumbnail rec={rec} />
                                {rec.durationSec ? (
                                  <span className="rec-dock-duration">
                                    {duration(rec.durationSec)}
                                  </span>
                                ) : null}
                              </div>
                              <p className="rec-dock-film-title">{rec.title}</p>
                            </div>
                          ))}
                        </div>
                      </div>,
                      plyrContainer
                    )}
                </div>

                {/* Film Title & Action Toolbar */}
                <div className="watch-header-card">
                  <div className="watch-header-left">
                    <div className="watch-eyebrow-row">
                      <span className="eyebrow">PROSCENIUM / NOW STREAMING</span>
                      {video.ageRestricted && (
                        <span className="mature-badge">18+</span>
                      )}
                    </div>

                    <h1 className="watch-title-text">{video.title}</h1>

                    <div className="watch-meta-pills">
                      {Number(video.avgRating || 0) > 0 && (
                        <span className="meta-pill rating-pill">
                          <Star size={12} fill="currentColor" />
                          <b>{Number(video.avgRating).toFixed(1)}</b>
                          {video.reviewCount ? ` (${video.reviewCount})` : ""}
                        </span>
                      )}

                      {video.releaseYear && (
                        <span className="meta-pill">{video.releaseYear}</span>
                      )}

                      {video.durationSec && (
                        <span className="meta-pill">
                          {duration(video.durationSec)}
                        </span>
                      )}

                      {video.language && (
                        <span className="meta-pill">{video.language}</span>
                      )}

                      <span className="meta-pill">
                        {(video.views || 0).toLocaleString()} views
                      </span>
                    </div>
                  </div>

                  <div className="watch-header-actions">
                    <div className="action-button-group">
                      <button
                        type="button"
                        className={`action-btn ${
                          video.reaction === "like" ? "active-like" : ""
                        }`}
                        onClick={() => react("like")}
                        title="Like this film"
                      >
                        <ThumbsUp size={15} fill={video.reaction === "like" ? "currentColor" : "none"} />
                        <span>{video.likes || 0}</span>
                      </button>

                      <div className="action-btn-divider" />

                      <button
                        type="button"
                        className={`action-btn ${
                          video.reaction === "dislike" ? "active-dislike" : ""
                        }`}
                        onClick={() => react("dislike")}
                        title="Dislike"
                      >
                        <ThumbsDown size={15} fill={video.reaction === "dislike" ? "currentColor" : "none"} />
                      </button>
                    </div>

                    <button
                      type="button"
                      className={`watchlist-btn ${video.saved ? "is-saved" : ""}`}
                      onClick={save}
                    >
                      {video.saved ? <Check size={15} /> : <Bookmark size={15} />}
                      <span>{video.saved ? "Saved" : "Watchlist"}</span>
                    </button>

                    <button
                      type="button"
                      className="share-btn"
                      onClick={handleShare}
                      title="Share Film"
                    >
                      <Share2 size={15} />
                      <span>{copiedLink ? "Copied!" : "Share"}</span>
                    </button>
                  </div>
                </div>

                {/* Below-Player Recommendations Shelf */}
                {recommendations.length > 0 && (
                  <div className="watch-rec-shelf-section">
                    <div className="watch-rec-shelf-header">
                      <div className="flex items-center gap-2">
                        <Film size={14} className="text-[#d9a653]" />
                        <span className="rec-section-title">
                          Recommended For You
                        </span>
                      </div>
                      <span className="rec-section-sub">
                        More curated indie cinema
                      </span>
                    </div>

                    <div className="watch-rec-grid">
                      {recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className="watch-rec-item"
                          onClick={() => navigate(`/viewer/videos/${rec.id}`)}
                        >
                          <div className="watch-rec-thumb-wrap">
                            <RecThumbnail rec={rec} />
                            {rec.durationSec ? (
                              <span className="rec-badge">
                                {duration(rec.durationSec)}
                              </span>
                            ) : null}
                            <div className="watch-rec-play-overlay">
                              <Play size={18} fill="currentColor" />
                            </div>
                          </div>
                          <div className="watch-rec-info">
                            <p className="watch-rec-name">{rec.title}</p>
                            <span className="watch-rec-meta">
                              {rec.directorName || rec.director || "Independent"}
                              {rec.releaseYear ? ` • ${rec.releaseYear}` : ""}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Side Review / Synopsis Panel */}
              <div className="watch-side-col">
                <WatchSidePanel
                  video={video}
                  videoId={id}
                  onReviewSaved={(review) => {
                    setReviews((current) => [
                      review,
                      ...current.filter((item) => item.viewerId !== viewerId),
                    ]);

                    setVideo((current) => ({
                      ...current,
                      avgRating: review.avgRating ?? current.avgRating,
                      reviewCount: review.reviewCount ?? current.reviewCount,
                      myReview: review,
                    }));
                  }}
                  onReviewDeleted={(data) => {
                    setReviews((current) =>
                      current.filter((item) => item.viewerId !== viewerId)
                    );

                    setVideo((current) => ({
                      ...current,
                      avgRating: data.avgRating,
                      reviewCount: data.reviewCount,
                      myReview: null,
                    }));
                  }}
                />
              </div>
            </div>
          </section>

          {/* Bottom Content Grid */}
          <div className="watch-content-grid">
            <div className="watch-main-tabs-col">
              {/* Tab Selector */}
              <div className="watch-tab-bar">
                <button
                  className={`tab-btn ${activeTab === "discussion" ? "active" : ""}`}
                  onClick={() => setActiveTab("discussion")}
                >
                  <MessageCircle size={15} />
                  <span>Discussion</span>
                  <span className="tab-count">{video.commentCount || comments.length}</span>
                </button>

                <button
                  className={`tab-btn ${activeTab === "reviews" ? "active" : ""}`}
                  onClick={() => setActiveTab("reviews")}
                >
                  <Star size={15} />
                  <span>Reviews & Community</span>
                  <span className="tab-count">{video.reviewCount || reviews.length}</span>
                </button>
              </div>

              {/* TAB 1: Discussion / Comments */}
              {activeTab === "discussion" && (
                <section className="watch-tab-pane">
                  <div className="comment-compose-card">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="Add to the discussion…"
                    />
                    <div className="compose-footer">
                      <span className="char-limit">{comment.length}/1000</span>
                      <button
                        onClick={postComment}
                        disabled={posting || !comment.trim()}
                        className="post-btn"
                      >
                        <Send size={14} />
                        <span>{posting ? "Posting…" : "Comment"}</span>
                      </button>
                    </div>
                  </div>

                  {comments.length ? (
                    <div className="comments-list">
                      {comments.map((item) => (
                        <CommentItem
                          key={item.id}
                          comment={item}
                          videoId={id}
                          currentViewerId={viewerId}
                          onChanged={loadComments}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <MessageCircle size={24} className="text-[#695d63] mb-2" />
                      <p>No comments yet.</p>
                      <span>Share your perspective on this indie film.</span>
                    </div>
                  )}
                </section>
              )}

              {/* TAB 2: Reviews */}
              {activeTab === "reviews" && (
                <section className="watch-tab-pane">
                  <div className="review-summary-banner">
                    <div className="summary-score">
                      <strong>{Number(video.avgRating || 0).toFixed(1)}</strong>
                      <div className="summary-stars">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <Star
                            key={val}
                            size={14}
                            fill={
                              val <= Math.round(Number(video.avgRating || 0))
                                ? "currentColor"
                                : "none"
                            }
                          />
                        ))}
                      </div>
                      <span>Based on {video.reviewCount || reviews.length} reviews</span>
                    </div>
                  </div>

                  <div className="reviews-list">
                    {reviews.map((rev) => (
                      <article key={rev.id} className="review-card">
                        <div className="review-card-head">
                          <div className="avatar">
                            {rev.viewerAvatarUrl ? (
                              <img src={rev.viewerAvatarUrl} alt="" />
                            ) : (
                              rev.viewerUsername?.[0]?.toUpperCase()
                            )}
                          </div>
                          <div className="review-user-info">
                            <b>{rev.viewerUsername}</b>
                            <div className="review-stars-row">
                              <span className="stars-gold">
                                {"★".repeat(Math.round(rev.rating))}
                                {"☆".repeat(5 - Math.round(rev.rating))}
                              </span>
                              <span className="rating-num">
                                {Number(rev.rating).toFixed(1)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => toggleReviewLike(rev.id)}
                            className={`review-like-btn ${rev.liked ? "liked" : ""}`}
                          >
                            <Heart size={13} fill={rev.liked ? "currentColor" : "none"} />
                            <span>{rev.likes || 0}</span>
                          </button>
                        </div>
                        <p className="review-text">{rev.text}</p>
                      </article>
                    ))}

                    {!reviews.length && (
                      <div className="empty-state">
                        <Star size={24} className="text-[#695d63] mb-2" />
                        <p>No community reviews yet.</p>
                        <span>Watch this film to be the first to publish a review.</span>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Right Column: Film Notes, Warnings, Cast */}
            <aside className="watch-sidebar-col">
              <div className="film-notes-card">
                <span className="eyebrow">FILM NOTES & CREDITS</span>

                {video.contentWarnings?.length ? (
                  <div className="warning-pill-box">
                    <p className="warning-label">Content Notice</p>
                    <p className="warning-text">
                      {video.contentWarnings.join(" • ")}
                    </p>
                  </div>
                ) : null}

                <div className="meta-stats-grid">
                  <div className="meta-stat-item">
                    <small>Director</small>
                    <b>{video.directorName || video.director || "Independent"}</b>
                  </div>
                  <div className="meta-stat-item">
                    <small>Country</small>
                    <b>{video.productionCountry || "Independent"}</b>
                  </div>
                  <div className="meta-stat-item">
                    <small>Unique Viewers</small>
                    <b>{(video.uniqueViews || 0).toLocaleString()}</b>
                  </div>
                  <div className="meta-stat-item">
                    <small>Total Discussions</small>
                    <b>{video.commentCount || comments.length}</b>
                  </div>
                </div>

                {video.cast?.length ? (
                  <div className="cast-section">
                    <h3>Featured Cast</h3>
                    <div className="cast-list">
                      {video.cast.slice(0, 6).map((c, idx) => (
                        <div key={c.id || idx} className="cast-item">
                          {c.photoUrl ? (
                            <img src={c.photoUrl} alt="" className="cast-photo" />
                          ) : (
                            <div className="cast-photo-fallback">
                              {c.name?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                          <div className="cast-names">
                            <p className="cast-real-name">{c.name}</p>
                            <small className="cast-role">{c.characterName || "Cast"}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}