"""Shared in-app notification service for viewers, directors and admins.

Every document is addressed to exactly one recipient (recipientRole + recipientId).
Viewer rows also carry the legacy `viewerId` field so the existing
/viewer/notifications endpoints and UI keep working.

Notification failures must never break the action that triggered them, so every
public helper swallows and logs its own errors.
"""

import logging
from datetime import datetime
from typing import Iterable, Optional

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

from database import (
    admin_collection,
    comments_collection,
    directors_collection,
    film_collection,
    notifications_collection,
    video_reviews_collection,
    viewers_collection,
)

log = logging.getLogger("proscenium.notifications")

ROLES = ("viewer", "director", "admin")
VIEW_MILESTONES = (10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000)

try:
    notifications_collection.create_index(
        [("recipientRole", ASCENDING), ("recipientId", ASCENDING), ("createdAt", DESCENDING)]
    )
    notifications_collection.create_index(
        [("recipientRole", ASCENDING), ("recipientId", ASCENDING), ("read", ASCENDING)]
    )
    notifications_collection.create_index(
        "dedupeKey", unique=True, partialFilterExpression={"dedupeKey": {"$type": "string"}}
    )
except Exception as exc:  # index creation must never block startup
    log.warning("notification index setup skipped: %s", exc)



# ------------------------------ links

def video_link(role: str, video_id) -> str:
    vid = str(video_id)
    if role == "director":
        return f"/director/videos/{vid}/watch"
    if role == "admin":
        return f"/admin/review?video={vid}"
    return f"/viewer/videos/{vid}"


# ------------------------------ core

def notify(
    role: str,
    recipient_id,
    type: str,
    title: str,
    message: str,
    *,
    actor_id=None,
    video_id=None,
    comment_id=None,
    review_id=None,
    link: Optional[str] = None,
    dedupe_key: Optional[str] = None,
    meta: Optional[dict] = None,
) -> bool:
    """Create one notification. Returns True if a new row was stored."""
    try:
        if role not in ROLES or recipient_id is None:
            return False
        recipient_id = ObjectId(str(recipient_id))
        if actor_id is not None:
            actor_id = ObjectId(str(actor_id))
            if actor_id == recipient_id:  # never notify someone about their own action
                return False

        doc = {
            "recipientRole": role,
            "recipientId": recipient_id,
            "type": type,
            "title": title,
            "message": message,
            "actorId": actor_id,
            "videoId": ObjectId(str(video_id)) if video_id else None,
            "commentId": ObjectId(str(comment_id)) if comment_id else None,
            "reviewId": ObjectId(str(review_id)) if review_id else None,
            "link": link or (video_link(role, video_id) if video_id else None),
            "meta": meta or {},
            "read": False,
            "createdAt": datetime.utcnow(),
        }
        if role == "viewer":
            doc["viewerId"] = recipient_id  # legacy field used by /viewer/notifications
        if dedupe_key:
            doc["dedupeKey"] = dedupe_key

        notifications_collection.insert_one(doc)
        return True
    except DuplicateKeyError:
        return False
    except Exception as exc:
        log.warning("notify failed (%s): %s", type, exc)
        return False


def notify_many(
    role: str,
    recipient_ids: Iterable,
    type: str,
    title: str,
    message: str,
    *,
    actor_id=None,
    dedupe_prefix: Optional[str] = None,
    **kwargs,
) -> int:
    sent = 0
    for rid in recipient_ids:
        key = f"{dedupe_prefix}:{rid}" if dedupe_prefix else None
        if notify(role, rid, type, title, message, actor_id=actor_id, dedupe_key=key, **kwargs):
            sent += 1
    return sent


def notify_admins(type: str, title: str, message: str, *, actor_id=None, **kwargs) -> int:
    """Fan out to every admin except the one who caused the event."""
    try:
        ids = [a["_id"] for a in admin_collection.find({}, {"_id": 1})]
    except Exception as exc:
        log.warning("admin lookup failed: %s", exc)
        return 0
    return notify_many("admin", ids, type, title, message, actor_id=actor_id, **kwargs)


def notify_new_release(video: dict) -> int:
    """Viewers who opted in to new-release notifications."""
    try:
        ids = [v["_id"] for v in viewers_collection.find(
            {"newReleaseNotifications": {"$ne": False}}, {"_id": 1})]
    except Exception as exc:
        log.warning("viewer lookup failed: %s", exc)
        return 0
    return notify_many(
        "viewer", ids, "new_release", "New film on Proscenium",
        f"{video.get('title', 'A new film')} is now available to watch.",
        video_id=video["_id"], dedupe_prefix=f"new_release:{video['_id']}",
    )



# ------------------------- helpers

def _title(video: Optional[dict]) -> str:
    return (video or {}).get("title") or "your film"


def _viewer_name(viewer_id) -> str:
    try:
        v = viewers_collection.find_one({"_id": viewer_id}, {"username": 1})
        return (v or {}).get("username") or "A viewer"
    except Exception:
        return "A viewer"


def _admin_name(admin_id) -> str:
    try:
        a = admin_collection.find_one({"_id": admin_id}, {"username": 1})
        return (a or {}).get("username") or "An admin"
    except Exception:
        return "An admin"


def _director_name(director_id) -> str:
    try:
        d = directors_collection.find_one({"_id": director_id}, {"username": 1})
        return (d or {}).get("username") or "A director"
    except Exception:
        return "A director"


def _snippet(text: str, n: int = 80) -> str:
    text = (text or "").strip().replace("\n", " ")
    return text if len(text) <= n else text[: n - 1] + "…"


# ------------------------- viewer-driven events

def on_comment_added(comment: dict, video: dict, actor_id) -> None:
    director_id = video.get("directorId")
    notify(
        "director", director_id, "new_comment", "New comment on your film",
        f"{_viewer_name(actor_id)} commented on {_title(video)}: “{_snippet(comment.get('text'))}”",
        actor_id=actor_id, video_id=video["_id"], comment_id=comment["_id"],
    )


def on_comment_reply(reply: dict, parent: dict, video: dict, actor_id) -> None:
    name = _viewer_name(actor_id)
    notify(
        "viewer", parent.get("viewerId"), "comment_reply", "New reply to your comment",
        f"{name} replied on {_title(video)}: “{_snippet(reply.get('text'))}”",
        actor_id=actor_id, video_id=video["_id"], comment_id=reply["_id"],
    )
    # Director hears about the reply too, unless it's already the viewer-notification recipient flow.
    notify(
        "director", video.get("directorId"), "new_comment", "New reply on your film",
        f"{name} replied in a discussion on {_title(video)}.",
        actor_id=actor_id, video_id=video["_id"], comment_id=reply["_id"],
    )


def on_comment_liked(comment: dict, video: dict, actor_id) -> None:
    notify(
        "viewer", comment.get("viewerId"), "comment_like", "Someone liked your comment",
        f"{_viewer_name(actor_id)} liked your comment on {_title(video)}.",
        actor_id=actor_id, video_id=comment.get("videoId"), comment_id=comment["_id"],
        dedupe_key=f"comment_like:{comment['_id']}:{actor_id}",
    )


def on_review_posted(review: dict, video: dict, actor_id) -> None:
    notify(
        "director", video.get("directorId"), "new_review", "New review on your film",
        f"{_viewer_name(actor_id)} rated {_title(video)} {review.get('rating')}/5.",
        actor_id=actor_id, video_id=video["_id"], review_id=review["_id"],
        dedupe_key=f"new_review:{review['_id']}",
    )


def on_review_liked(review: dict, video: dict, actor_id) -> None:
    notify(
        "viewer", review.get("viewerId"), "review_like", "Someone liked your review",
        f"{_viewer_name(actor_id)} liked your review of {_title(video)}.",
        actor_id=actor_id, video_id=review.get("videoId"), review_id=review["_id"],
        dedupe_key=f"review_like:{review['_id']}:{actor_id}",
    )


def on_view_counted(video_id) -> None:
    """Call after a view is counted; notifies the director only at milestones."""
    try:
        video = film_collection.find_one({"_id": video_id}, {"views": 1, "title": 1, "directorId": 1})
        if not video:
            return
        views = int(video.get("views", 0))
        if views not in VIEW_MILESTONES:
            return
        notify(
            "director", video.get("directorId"), "view_milestone", "Viewing milestone reached",
            f"{_title(video)} just passed {views:,} views.",
            video_id=video_id, dedupe_key=f"view_milestone:{video_id}:{views}",
        )
    except Exception as exc:
        log.warning("view milestone check failed: %s", exc)


# ------------------------- admin-driven events

def on_video_approved(video: dict, admin_id, comment: Optional[str] = None) -> None:
    admin = _admin_name(admin_id)
    extra = f" Note: {_snippet(comment)}" if comment else ""
    notify(
        "director", video.get("directorId"), "video_approved", "Your film was approved",
        f"{_title(video)} is approved and now live.{extra}",
        actor_id=admin_id, video_id=video["_id"],
    )
    notify_admins(
        "video_approved", "Film approved",
        f"{admin} approved {_title(video)}.",
        actor_id=admin_id, video_id=video["_id"],
    )


def on_video_rejected(video: dict, admin_id, reason: Optional[str] = None) -> None:
    admin = _admin_name(admin_id)
    extra = f" Reason: {_snippet(reason)}" if reason else ""
    notify(
        "director", video.get("directorId"), "video_rejected", "Your film was rejected",
        f"{_title(video)} was not approved.{extra}",
        actor_id=admin_id, video_id=video["_id"],
    )
    notify_admins(
        "video_rejected", "Film rejected",
        f"{admin} rejected {_title(video)}.",
        actor_id=admin_id, video_id=video["_id"],
    )


def on_admin_note(video: dict, admin_id, note: str) -> None:
    notify_admins(
        "admin_note", "Moderation note added",
        f"{_admin_name(admin_id)} left a note on {_title(video)}: “{_snippet(note)}”",
        actor_id=admin_id, video_id=video["_id"],
    )


def on_director_suspended(director: dict, admin_id, reason: Optional[str] = None) -> None:
    extra = f" Reason: {_snippet(reason)}" if reason else ""
    notify(
        "director", director["_id"], "account_suspended", "Your account was suspended",
        f"An administrator suspended your director account.{extra}",
        actor_id=admin_id, link="/director",
    )
    notify_admins(
        "director_suspended", "Director suspended",
        f"{_admin_name(admin_id)} suspended {director.get('username', 'a director')}.",
        actor_id=admin_id, link="/admin/content",
    )


def on_director_reinstated(director: dict, admin_id) -> None:
    notify(
        "director", director["_id"], "account_reinstated", "Your account was reinstated",
        "Your director account is active again.",
        actor_id=admin_id, link="/director",
    )
    notify_admins(
        "director_reinstated", "Director reinstated",
        f"{_admin_name(admin_id)} reinstated {director.get('username', 'a director')}.",
        actor_id=admin_id, link="/admin/content",
    )


def on_feedback_removed(kind: str, item: dict, video: Optional[dict], admin_id) -> None:
    """Moderation notice to the viewer whose comment/review was removed."""
    notify(
        "viewer", item.get("viewerId"), f"{kind}_removed", f"Your {kind} was removed",
        f"A moderator removed your {kind} on {_title(video)} for violating community guidelines.",
        actor_id=admin_id, video_id=item.get("videoId"),
    )


# ----------------- director-driven events

def on_video_submitted(video: dict, director_id) -> None:
    notify_admins(
        "video_submitted", "New film awaiting review",
        f"{_director_name(director_id)} submitted {_title(video)} for review.",
        actor_id=director_id, video_id=video["_id"],
    )


def on_video_reuploaded(video: dict, director_id, title: Optional[str] = None) -> None:
    notify_admins(
        "video_reuploaded", "Film re-uploaded",
        f"{_director_name(director_id)} re-uploaded {title or _title(video)}.",
        actor_id=director_id, video_id=video["_id"],
    )


def on_video_resubmitted(video: dict, director_id) -> None:
    notify_admins(
        "video_resubmitted", "Film resubmitted for review",
        f"{_director_name(director_id)} resubmitted {_title(video)}.",
        actor_id=director_id, video_id=video["_id"],
    )
