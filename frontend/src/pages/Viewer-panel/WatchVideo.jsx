import React, { useEffect, useRef, useState,} from "react";
import { useNavigate,useParams,} from "react-router-dom";
import Plyr from "plyr";
import Hls from "hls.js";
import { ArrowLeft, Bookmark, Check, Edit3, MessageCircle, Send, Star, ThumbsDown, ThumbsUp, Trash2, X,} from "lucide-react";

import "plyr/dist/plyr.css";
import "./WatchVideo.css";

import {deleteRequest,getRequest,postJson,putJson,} from "../../api/client.js";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";

const duration = (seconds) => {
  const value = Math.max(
    0,
    Math.round(Number(seconds) || 0)
  );

  const hours = Math.floor(
    value / 3600
  );

  const minutes = Math.floor(
    (value % 3600) / 60
  );

  return hours
    ? `${hours}h ${minutes}m`
    : `${minutes}m`;
};

function CommentItem({
  comment,
  videoId,
  currentViewerId,
  onChanged,
  depth = 0,
}) {
  const [replies, setReplies] =
    useState([]);

  const [showReplies, setShowReplies] =
    useState(false);

  const [reply, setReply] =
    useState("");

  const [editing, setEditing] =
    useState(false);

  const [text, setText] =
    useState(comment.text);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [likes, setLikes] =
    useState(
      Number(comment.likes || 0)
    );

  const [dislikes, setDislikes] =
    useState(
      Number(comment.dislikes || 0)
    );

  const [reaction, setReaction] =
    useState(
      comment.reaction || null
    );

  const owner =
    comment.viewerId ===
    currentViewerId;

  async function loadReplies() {
    try {
      const data =
        await getRequest(
          `/viewer/videos/${videoId}/comments/${comment.id}/replies?limit=100`
        );

      setReplies(
        data.replies || []
      );

      setShowReplies(true);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load replies."
      );
    }
  }

  async function sendReply() {
    if (!reply.trim()) return;

    setBusy(true);

    try {
      await postJson(
        `/viewer/videos/${videoId}/comments/${comment.id}/reply`,
        {
          text: reply.trim(),
        }
      );

      setReply("");

      await loadReplies();

      onChanged();
    } catch (err) {
      setError(
        err.message ||
          "Unable to post reply."
      );
    } finally {
      setBusy(false);
    }
  }

  async function react(type) {
    try {
      const data =
        await postJson(
          `/viewer/videos/${videoId}/comments/${comment.id}/react`,
          {
            type,
          }
        );

      setLikes(
        Number(data.likes || 0)
      );

      setDislikes(
        Number(data.dislikes || 0)
      );

      setReaction(
        data.reaction || null
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to update comment reaction."
      );
    }
  }

  async function edit() {
    if (!text.trim()) return;

    setBusy(true);

    try {
      await putJson(
        `/viewer/videos/${videoId}/comments/${comment.id}`,
        {
          text: text.trim(),
        }
      );

      setEditing(false);

      onChanged();
    } catch (err) {
      setError(
        err.message ||
          "Unable to edit comment."
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        "Delete this comment and its replies?"
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      await deleteRequest(
        `/viewer/videos/${videoId}/comments/${comment.id}`
      );

      onChanged();
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete comment."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={
        depth
          ? "comment reply"
          : "comment"
      }
    >
      <div className="avatar">
        {comment.viewerAvatarUrl ? (
          <img
            src={comment.viewerAvatarUrl}
            alt=""
          />
        ) : (
          comment.viewerUsername
            ?.charAt(0)
            ?.toUpperCase()
        )}
      </div>

      <div className="comment-body">
        <div className="comment-head">
          <b>
            {comment.viewerUsername}
          </b>
        </div>

        {editing ? (
          <div className="edit-row">
            <input
              value={text}
              onChange={(event) =>
                setText(
                  event.target.value
                )
              }
              maxLength={1000}
            />

            <button
              onClick={edit}
              disabled={busy}
            >
              <Check size={15} />
            </button>

            <button
              onClick={() => {
                setEditing(false);
                setText(comment.text);
              }}
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <p>{comment.text}</p>
        )}

        <div className="comment-actions">
          <button
            className={
              reaction === "like"
                ? "selected"
                : ""
            }
            onClick={() =>
              react("like")
            }
          >
            <ThumbsUp size={12} />
            {likes}
          </button>

          <button
            className={
              reaction === "dislike"
                ? "selected"
                : ""
            }
            onClick={() =>
              react("dislike")
            }
          >
            <ThumbsDown size={12} />
            {dislikes}
          </button>

          <button
            onClick={() =>
              showReplies
                ? setShowReplies(false)
                : loadReplies()
            }
          >
            Reply
            {comment.replyIds?.length
              ? ` (${comment.replyIds.length})`
              : ""}
          </button>

          {owner && (
            <>
              <button
                onClick={() =>
                  setEditing(true)
                }
              >
                <Edit3 size={12} />
                Edit
              </button>

              <button
                onClick={remove}
                disabled={busy}
              >
                <Trash2 size={12} />
                Delete
              </button>
            </>
          )}
        </div>

        {showReplies && (
          <div>
            {replies.map((item) => (
              <CommentItem
                key={item.id}
                comment={item}
                videoId={videoId}
                currentViewerId={
                  currentViewerId
                }
                onChanged={
                  loadReplies
                }
                depth={depth + 1}
              />
            ))}
          </div>
        )}

        {showReplies && (
          <div className="reply-box">
            <input
              value={reply}
              onChange={(event) =>
                setReply(
                  event.target.value
                )
              }
              placeholder="Write a reply…"
              maxLength={1000}
            />

            <button
              onClick={sendReply}
              disabled={
                busy ||
                !reply.trim()
              }
            >
              <Send size={15} />
            </button>
          </div>
        )}

        {error && (
          <small className="watch-error">
            {error}
          </small>
        )}
      </div>
    </div>
  );
}

export default function ViewerWatchVideo() {
  const { id } = useParams();

  const navigate = useNavigate();

  const [video, setVideo] =
    useState(null);

  const [stream, setStream] =
    useState(null);

  const [comments, setComments] =
    useState([]);

  const [reviews, setReviews] =
    useState([]);

  const [comment, setComment] =
    useState("");

  const [reviewText, setReviewText] =
    useState("");

  const [reviewRating, setReviewRating] =
    useState(0);

  const [myReview, setMyReview] =
    useState(null);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [posting, setPosting] =
    useState(false);

  const [reviewing, setReviewing] =
    useState(false);

  const [watching, setWatching] =
    useState(false);

  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hlsRef = useRef(null);
  const heartbeatRef =
    useRef(null);

  const auth = JSON.parse(
    localStorage.getItem(
      "proscenium_auth"
    ) || "null"
  );

  const viewerId = auth?.userId;

  async function loadComments() {
    try {
      const data =
        await getRequest(
          `/viewer/videos/${id}/comments?limit=100`
        );

      setComments(
        data.comments || []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load comments."
      );
    }
  }

  async function loadReviews() {
    try {
      const data =
        await getRequest(
          `/viewer/videos/${id}/reviews`
        );

      const rows =
        data.reviews || [];

      setReviews(rows);

      setMyReview(
        rows.find(
          (review) =>
            review.viewerId ===
            viewerId
        ) || null
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load reviews."
      );
    }
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      /*
       * Detail endpoint remains protected by
       * the existing backend moderation rules.
       */
      const [
        videoData,
        commentsData,
        watchData,
        reviewsData,
      ] = await Promise.all([
        getRequest(
          `/viewer/videos/${id}`
        ),
        getRequest(
          `/viewer/videos/${id}/comments?limit=100`
        ),
        getRequest(
          `/viewer/videos/${id}/watch`
        ),
        getRequest(
          `/viewer/videos/${id}/reviews`
        ),
      ]);

      setVideo(videoData);

      setComments(
        commentsData.comments || []
      );

      setStream(watchData);

      const rows =
        reviewsData.reviews || [];

      setReviews(rows);

      const mine = rows.find(
        (item) =>
          item.viewerId === viewerId
      );

      setMyReview(mine);
      setReviewRating(
        mine?.rating || 0
      );
      setReviewText(
        mine?.text || ""
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load this film."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    return () => {
      clearInterval(
        heartbeatRef.current
      );

      playerRef.current?.destroy();
      hlsRef.current?.destroy();
    };
  }, [id]);

  useEffect(() => {
    if (
      !stream?.stream_url ||
      !videoRef.current
    ) {
      return;
    }

    const element =
      videoRef.current;

    let plyr;
    let hls;

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
        const resume =
          Number(
            stream.resumeTimeSec || 0
          );

        const total =
          Number(
            video?.durationSec || 0
          );

        if (
          resume > 5 &&
          (!total ||
            resume < total - 5)
        ) {
          player.currentTime =
            resume;
        }
      });

      player.on("play", () =>
        setWatching(true)
      );

      player.on("pause", () =>
        setWatching(false)
      );

      player.on("ended", () =>
        setWatching(false)
      );
    };

    if (Hls.isSupported()) {
      hls = new Hls();

      hlsRef.current = hls;

      hls.attachMedia(element);

      hls.on(
        Hls.Events.MEDIA_ATTACHED,
        () => {
          hls.loadSource(
            stream.stream_url
          );
        }
      );

      hls.on(
        Hls.Events.MANIFEST_PARSED,
        () => {
          const qualities = hls.levels
            .map(
              (level) =>
                level.height
            )
            .filter(Boolean)
            .sort(
              (a, b) => a - b
            );

          const options = {
            ...baseOptions,
            settings: [
              "quality",
              "speed",
            ],
          };

          if (qualities.length) {
            options.quality = {
              default:
                qualities[
                  qualities.length -
                    1
                ],
              options: qualities,
              forced: true,

              onChange: (quality) => {
                const level =
                  hls.levels.findIndex(
                    (item) =>
                      item.height ===
                      quality
                  );

                if (level >= 0) {
                  hls.currentLevel =
                    level;
                }
              },
            };
          }

          plyr = new Plyr(
            element,
            options
          );

          playerRef.current =
            plyr;

          setupPlayer(plyr);
        }
      );

      hls.on(
        Hls.Events.ERROR,
        (_, data) => {
          if (data.fatal) {
            setError(
              "Playback error — the stream failed to load."
            );
          }
        }
      );
    } else if (
      element.canPlayType(
        "application/vnd.apple.mpegurl"
      )
    ) {
      element.src =
        stream.stream_url;

      plyr = new Plyr(
        element,
        baseOptions
      );

      playerRef.current =
        plyr;

      setupPlayer(plyr);
    }

    return () => {
      hls?.destroy();
      plyr?.destroy();
    };
  }, [
    stream?.stream_url,
    stream?.resumeTimeSec,
    video?.durationSec,
  ]);

  useEffect(() => {
    if (!watching) {
      return;
    }

    heartbeatRef.current =
      setInterval(() => {
        const currentTime =
          playerRef.current
            ?.currentTime;

        if (
          typeof currentTime ===
          "number"
        ) {
          postJson(
            `/viewer/videos/${id}/heartbeat`,
            {
              currentTimeSec:
                currentTime,
            }
          ).catch(() => {});
        }
      }, 5000);

    return () =>
      clearInterval(
        heartbeatRef.current
      );
  }, [watching, id]);

  useEffect(
    () => () => {
      const currentTime =
        playerRef.current
          ?.currentTime;

      if (
        typeof currentTime ===
        "number"
      ) {
        postJson(
          `/viewer/videos/${id}/heartbeat`,
          {
            currentTimeSec:
              currentTime,
          }
        ).catch(() => {});
      }
    },
    [id]
  );

  async function react(type) {
    try {
      const data =
        await postJson(
          `/viewer/videos/${id}/react`,
          {
            type,
          }
        );

      setVideo((current) => ({
        ...current,
        reaction: data.reaction,
        likes: data.likes,
        dislikes: data.dislikes,
      }));
    } catch (err) {
      setError(
        err.message ||
          "Unable to update reaction."
      );
    }
  }

  async function save() {
    try {
      const data =
        await postJson(
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
      setError(
        err.message ||
          "Unable to update watchlist."
      );
    }
  }

  async function postComment() {
    if (!comment.trim()) {
      return;
    }

    setPosting(true);

    try {
      await postJson(
        `/viewer/videos/${id}/comments`,
        {
          text: comment.trim(),
        }
      );

      setComment("");

      await loadComments();

      setVideo((current) => ({
        ...current,
        commentCount:
          Number(
            current.commentCount || 0
          ) + 1,
      }));
    } catch (err) {
      setError(
        err.message ||
          "Unable to post comment."
      );
    } finally {
      setPosting(false);
    }
  }

  async function saveReview() {
    if (
      !reviewRating ||
      !reviewText.trim()
    ) {
      return;
    }

    setReviewing(true);

    try {
      const review =
        await postJson(
          `/viewer/videos/${id}/reviews`,
          {
            rating: reviewRating,
            text: reviewText.trim(),
          }
        );

      setMyReview(review);

      setReviews((current) => [
        review,
        ...current.filter(
          (item) =>
            item.viewerId !==
            viewerId
        ),
      ]);

      setVideo((current) => ({
        ...current,
        avgRating:
          review.avgRating ??
          current.avgRating,
        reviewCount:
          review.reviewCount ??
          current.reviewCount,
      }));

      await load();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save review."
      );
    } finally {
      setReviewing(false);
    }
  }

  async function deleteReview() {
    try {
      const data =
        await deleteRequest(
          `/viewer/videos/${id}/reviews`
        );

      setMyReview(null);
      setReviewText("");
      setReviewRating(0);

      setReviews((current) =>
        current.filter(
          (item) =>
            item.viewerId !==
            viewerId
        )
      );

      setVideo((current) => ({
        ...current,
        avgRating:
          data.avgRating,
        reviewCount:
          data.reviewCount,
      }));
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete review."
      );
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="watch-page">
          <div className="watch-loading">
            Loading film…
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
            {error ||
              "Film not found."}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="watch-page">
        <main className="watch-main">
          <button
            className="back-button"
            onClick={() =>
              navigate(-1)
            }
          >
            <ArrowLeft size={15} />
            Back
          </button>

          {error && (
            <div className="watch-alert">
              {error}

              <button
                onClick={() =>
                  setError("")
                }
              >
                <X size={14} />
              </button>
            </div>
          )}

          <section className="watch-hero">
            <div className="watch-player">
              <video
                ref={videoRef}
                title={video.title}
                playsInline
              />
            </div>

            <div className="watch-title">
              <div>
                <span className="eyebrow">
                  PROSCENIUM / NOW PLAYING
                </span>

                <h1>{video.title}</h1>

                <div className="watch-meta">
                  <span>
                    <Star
                      size={13}
                      fill="currentColor"
                    />

                    {Number(
                      video.avgRating ||
                        0
                    ).toFixed(1)}
                  </span>

                  <span>
                    {video.releaseYear ||
                      ""}
                  </span>

                  <span>
                    {video.language ||
                      ""}
                  </span>

                  <span>
                    {duration(
                      video.durationSec
                    )}
                  </span>

                  <span>
                    {video.views || 0} views
                  </span>
                </div>
              </div>

              <button
                className={`save-button ${
                  video.saved
                    ? "saved"
                    : ""
                }`}
                onClick={save}
              >
                {video.saved ? (
                  <Check size={16} />
                ) : (
                  <Bookmark size={16} />
                )}

                {video.saved
                  ? "Saved"
                  : "Watchlist"}
              </button>
            </div>

            <div className="reaction-row">
              <button
                className={
                  video.reaction ===
                  "like"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  react("like")
                }
              >
                <ThumbsUp size={16} />
                {video.likes || 0}
              </button>

              <button
                className={
                  video.reaction ===
                  "dislike"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  react("dislike")
                }
              >
                <ThumbsDown size={16} />
                {video.dislikes || 0}
              </button>
            </div>

            <p className="watch-description">
              {video.description ||
                "No description available."}
            </p>

            <div className="tag-row">
              {(video.genres || []).map(
                (item) => (
                  <span key={item}>
                    {item}
                  </span>
                )
              )}
            </div>
          </section>

          <div className="watch-grid">
            <section className="watch-section">
              <div className="section-title">
                <MessageCircle
                  size={18}
                />

                <h2>Comments</h2>

                <span>
                  {video.commentCount ||
                    comments.length}
                </span>
              </div>

              <div className="comment-compose">
                <textarea
                  value={comment}
                  onChange={(event) =>
                    setComment(
                      event.target.value
                    )
                  }
                  maxLength={1000}
                  rows={3}
                  placeholder="Share your thoughts…"
                />

                <button
                  onClick={
                    postComment
                  }
                  disabled={
                    posting ||
                    !comment.trim()
                  }
                >
                  <Send size={16} />
                </button>
              </div>

              {comments.length ? (
                <div className="comments">
                  {comments.map(
                    (item) => (
                      <CommentItem
                        key={item.id}
                        comment={item}
                        videoId={id}
                        currentViewerId={
                          viewerId
                        }
                        onChanged={
                          loadComments
                        }
                      />
                    )
                  )}
                </div>
              ) : (
                <div className="empty-watch">
                  No comments yet. Be
                  the first.
                </div>
              )}
            </section>

            <aside>
              <section className="info-card">
                <span className="eyebrow">
                  FILM NOTES
                </span>

                {video.contentWarnings
                  ?.length ? (
                  <p className="warning">
                    {video.contentWarnings.join(
                      " · "
                    )}
                  </p>
                ) : null}

                <div className="info-grid">
                  <div>
                    <small>
                      Production
                    </small>

                    <b>
                      {video.productionCountry ||
                        "—"}
                    </b>
                  </div>

                  <div>
                    <small>
                      Unique viewers
                    </small>

                    <b>
                      {video.uniqueViews ||
                        0}
                    </b>
                  </div>

                  <div>
                    <small>
                      Reviews
                    </small>

                    <b>
                      {video.reviewCount ||
                        0}
                    </b>
                  </div>
                </div>

                {video.cast?.length ? (
                  <div className="cast">
                    <h3>Cast</h3>

                    {video.cast
                      .slice(0, 5)
                      .map(
                        (
                          cast,
                          index
                        ) => (
                          <div
                            key={
                              cast.id ||
                              index
                            }
                          >
                            {cast.photoUrl ? (
                              <img
                                src={
                                  cast.photoUrl
                                }
                                alt=""
                              />
                            ) : (
                              <span />
                            )}

                            <p>
                              {cast.name}

                              <small>
                                {
                                  cast.characterName
                                }
                              </small>
                            </p>
                          </div>
                        )
                      )}
                  </div>
                ) : null}
              </section>
            </aside>
          </div>

          <section className="review-section">
            <div className="section-title">
              <Star size={18} />

              <h2>
                Ratings & Reviews
              </h2>

              <span>
                {video.reviewCount ||
                  reviews.length}
              </span>
            </div>

            <div className="review-layout">
              <div className="review-score">
                <strong>
                  {Number(
                    video.avgRating ||
                      0
                  ).toFixed(1)}
                </strong>

                <span>
                  out of 5
                </span>

                <div>
                  {[1, 2, 3, 4, 5].map(
                    (value) => (
                      <Star
                        key={value}
                        size={16}
                        fill={
                          value <=
                          Math.round(
                            Number(
                              video.avgRating ||
                                0
                            )
                          )
                            ? "currentColor"
                            : "none"
                        }
                      />
                    )
                  )}
                </div>
              </div>

              <div className="review-form">
                <div className="star-input">
                  {[1, 2, 3, 4, 5].map(
                    (value) => (
                      <button
                        key={value}
                        onClick={() =>
                          setReviewRating(
                            value
                          )
                        }
                        className={
                          value <=
                          reviewRating
                            ? "active"
                            : ""
                        }
                      >
                        <Star
                          size={22}
                          fill="currentColor"
                        />
                      </button>
                    )
                  )}
                </div>

                <textarea
                  value={reviewText}
                  onChange={(event) =>
                    setReviewText(
                      event.target.value
                    )
                  }
                  maxLength={1000}
                  placeholder="Write your review…"
                />

                <div>
                  <button
                    className="primary-review"
                    onClick={
                      saveReview
                    }
                    disabled={
                      reviewing ||
                      !reviewRating ||
                      !reviewText.trim()
                    }
                  >
                    {reviewing
                      ? "Saving…"
                      : myReview
                      ? "Update Review"
                      : "Publish Review"}
                  </button>

                  {myReview && (
                    <button
                      className="delete-review"
                      onClick={
                        deleteReview
                      }
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="review-list">
              {reviews.map((review) => (
                <article
                  key={review.id}
                >
                  <div className="review-avatar">
                    {review.viewerAvatarUrl ? (
                      <img
                        src={
                          review.viewerAvatarUrl
                        }
                        alt=""
                      />
                    ) : (
                      review.viewerUsername?.[0]?.toUpperCase()
                    )}
                  </div>

                  <div>
                    <b>
                      {
                        review.viewerUsername
                      }
                    </b>

                    <div className="stars">
                      {"★".repeat(
                        review.rating
                      )}

                      {"☆".repeat(
                        5 -
                          review.rating
                      )}
                    </div>

                    <p>
                      {review.text}
                    </p>
                  </div>
                </article>
              ))}

              {!reviews.length && (
                <div className="empty-watch">
                  No reviews yet.
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </DashboardLayout>
  );
}