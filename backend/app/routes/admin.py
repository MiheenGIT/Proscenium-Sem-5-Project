from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query

from database import (
    cast_collection,
    comments_collection,
    video_reviews_collection,
    directors_collection,
    film_collection,
    notifications_collection,
    viewers_collection,
)
from models.schemas import (
    AdminNoteRequest,
    AgeRestrictionRequest,
    ApproveVideoRequest,
    BulkApproveRequest,
    BulkRejectRequest,
    ContentWarningsRequest,
    DirectorSuspendRequest,
    FeaturedRequest,
    RejectVideoRequest,
)
from utils.security import require_role
from utils.moderation import check_comment_text

router = APIRouter(prefix="/admin", tags=["admin"])


# ============================================================
# HELPERS
# ============================================================

def _serialize_mongo(value):
    """
    Recursively convert MongoDB values into JSON-safe values.

    Handles:
    - ObjectId
    - dict
    - list
    - tuple
    """
    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, dict):
        return {
            key: _serialize_mongo(val)
            for key, val in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [
            _serialize_mongo(item)
            for item in value
        ]

    return value


def _get_video_or_404(video_id: str):
    try:
        oid = ObjectId(video_id)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid video id",
        )

    video = film_collection.find_one({"_id": oid})

    if not video:
        raise HTTPException(
            status_code=404,
            detail="Video not found",
        )

    return oid, video


def _serialize_video(video: dict) -> dict:
    return _serialize_mongo(video)


def _feedback_is_flagged(item: dict) -> bool:
    return bool(item.get("moderationFlagged") or item.get("aiFlagged"))


def _current_flagged_feedback():
    """Return feedback that is flagged by the current moderation rules.

    Existing records are re-checked so the Admin dashboard does not depend on
    stale moderation fields written by an older moderation implementation.
    Invalid/orphaned feedback records are ignored rather than breaking the
    dashboard feed.
    """
    flagged_comments = []
    flagged_reviews = []

    for item in comments_collection.find({}):
        try:
            item = _refresh_moderation(comments_collection, item)
            if _feedback_is_flagged(item):
                flagged_comments.append(item)
        except Exception:
            continue

    for item in video_reviews_collection.find({}):
        try:
            item = _refresh_moderation(video_reviews_collection, item)
            if _feedback_is_flagged(item):
                flagged_reviews.append(item)
        except Exception:
            continue

    return flagged_comments, flagged_reviews


def _flagged_feedback_counts(video_ids):
    """Return current flagged comment/review counts keyed by video id."""
    if not video_ids:
        return {}

    counts = {oid: 0 for oid in video_ids}
    flagged_comments, flagged_reviews = _current_flagged_feedback()

    for item in flagged_comments + flagged_reviews:
        video_id = item.get("videoId")
        if video_id in counts:
            counts[video_id] += 1

    return counts


# ============================================================
# LIST ALL VIDEOS
# ============================================================

@router.get("/videos")
def list_all_videos(
    status: str | None = None,
    title: str | None = None,
    directorId: str | None = None,
    genre: str | None = None,
    payload: dict = Depends(require_role("admin")),
):
    valid_statuses = {
        "pending",
        "approved",
        "rejected",
    }

    query = {}

    if status:
        if status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"status must be one of {sorted(valid_statuses)}",
            )

        query["moderationStatus"] = status

    if title:
        query["title"] = {"$regex": title.strip(), "$options": "i"}

    if directorId:
        try:
            query["directorId"] = ObjectId(directorId)
        except (InvalidId, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Invalid director id",
            )

    if genre:
        query["genres"] = genre

    # Pending queue = oldest first.
    # Other videos = newest first.
    sort_dir = 1 if status == "pending" else -1

    videos = list(
        film_collection
        .find(query)
        .sort("uploadedAt", sort_dir)
    )

    # Keep catalogue summary independent from the active status filter.
    # The cards can be filtered, but the KPI/tab counts must always describe
    # the complete Admin catalogue.
    summary_counts = {
        "total": film_collection.count_documents({}),
        "pending": film_collection.count_documents({"moderationStatus": "pending"}),
        "approved": film_collection.count_documents({"moderationStatus": "approved"}),
        "rejected": film_collection.count_documents({"moderationStatus": "rejected"}),
    }

    flagged_comments, flagged_reviews = _current_flagged_feedback()
    all_flagged_counts = {}
    for item in flagged_comments + flagged_reviews:
        video_id = item.get("videoId")
        if video_id:
            all_flagged_counts[video_id] = all_flagged_counts.get(video_id, 0) + 1
    flagged_total = sum(1 for count in all_flagged_counts.values() if count > 0)

    # Resolve director display information in one query so Admin cards don't
    # expose opaque ObjectIds as the primary identity.
    director_ids = [video.get("directorId") for video in videos if video.get("directorId")]
    directors = {}
    if director_ids:
        directors = {
            doc["_id"]: _serialize_mongo(doc)
            for doc in directors_collection.find(
                {"_id": {"$in": director_ids}},
                {"username": 1, "studioName": 1, "avatarUrl": 1, "accountStatus": 1},
            )
        }

    flagged_counts = all_flagged_counts
    serialized_videos = []
    for video in videos:
        item = _serialize_video(video)
        flagged_count = flagged_counts.get(video.get("_id"), 0)
        item["flaggedFeedbackCount"] = flagged_count
        item["hasFlaggedFeedback"] = flagged_count > 0
        director = directors.get(video.get("directorId"))
        item["director"] = director
        serialized_videos.append(item)

    return {
        "count": len(serialized_videos),
        "videos": serialized_videos,
        "summary": {
            **summary_counts,
            "flaggedVideos": flagged_total,
        },
    }


# ============================================================
# GET SINGLE VIDEO
# ============================================================

@router.get("/videos/{video_id}")
def get_video_detail(
    video_id: str,
    payload: dict = Depends(require_role("admin")),
):
    _, video = _get_video_or_404(video_id)

    result = _serialize_video(video)

    director_id = video.get("directorId")
    if director_id:
        director = directors_collection.find_one(
            {"_id": director_id},
            {
                "username": 1,
                "email": 1,
                "studioName": 1,
                "avatarUrl": 1,
                "accountStatus": 1,
            },
        )
        result["director"] = _serialize_mongo(director) if director else None

    cast_ids = video.get("cast") or []
    if cast_ids:
        cast_members = list(cast_collection.find({"_id": {"$in": cast_ids}}))
        result["cast"] = [_serialize_mongo(c) for c in cast_members]

    return result


# ============================================================
# WATCH VIDEO
# ============================================================

@router.get("/videos/{video_id}/watch")
def watch_video(
    video_id: str,
    payload: dict = Depends(require_role("admin")),
):
    _, video = _get_video_or_404(video_id)

    stream_url = video.get("hlsManifestUrl")

    if not stream_url:
        raise HTTPException(
            status_code=404,
            detail="Video stream is not available",
        )

    return {
        "title": video.get("title", ""),
        "stream_url": stream_url,
    }


# ============================================================
# APPROVE VIDEO
# ============================================================

@router.post("/videos/{video_id}/approve")
def approve_video(
    video_id: str,
    body: ApproveVideoRequest,
    payload: dict = Depends(require_role("admin")),
):
    oid, video = _get_video_or_404(video_id)

    if video.get("moderationStatus") == "approved":
        raise HTTPException(
            status_code=400,
            detail="Video is already approved",
        )

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])

    history_entry = {
        "action": "approved",
        "comment": body.comment,
        "moderatedBy": moderator_id,
        "moderatedAt": now,
    }

    film_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "moderationStatus": "approved",
                "moderationComment": body.comment,
                "moderatedBy": moderator_id,
                "moderatedAt": now,
                "status": "ready",
                "visibility": "public",
                "publishedAt": now,
                "updatedAt": now,
            },
            "$push": {
                "moderationHistory": history_entry,
            },
        },
    )

    # Notify viewers who have enabled new-release notifications.
    for viewer in viewers_collection.find(
        {"newReleaseNotifications": {"$ne": False}},
        {"_id": 1},
    ):
        notifications_collection.insert_one(
            {
                "viewerId": viewer["_id"],
                "type": "new_release",
                "title": "New film on Proscenium",
                "message": (
                    f"{video.get('title', 'A new film')} "
                    "is now available to watch."
                ),
                "videoId": oid,
                "read": False,
                "createdAt": now,
            }
        )

    return {
        "message": "Video approved",
        "videoId": video_id,
        "comment": body.comment,
    }


# ============================================================
# REJECT VIDEO
# ============================================================

@router.post("/videos/{video_id}/reject")
def reject_video(
    video_id: str,
    body: RejectVideoRequest,
    payload: dict = Depends(require_role("admin")),
):
    oid, video = _get_video_or_404(video_id)

    if video.get("moderationStatus") == "rejected":
        raise HTTPException(
            status_code=400,
            detail="Video is already rejected",
        )

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])

    history_entry = {
        "action": "rejected",
        "comment": body.reason,
        "moderatedBy": moderator_id,
        "moderatedAt": now,
    }

    film_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "moderationStatus": "rejected",
                "moderationComment": body.reason,
                "moderatedBy": moderator_id,
                "moderatedAt": now,
                "visibility": "private",
                "updatedAt": now,
            },
            "$push": {
                "moderationHistory": history_entry,
            },
        },
    )

    return {
        "message": "Video rejected",
        "videoId": video_id,
        "reason": body.reason,
    }


# ============================================================
# RESET VIDEO STATUS
# ============================================================

@router.post("/videos/{video_id}/reset")
def reset_video_status(
    video_id: str,
    payload: dict = Depends(require_role("admin")),
):
    oid, video = _get_video_or_404(video_id)

    current_status = video.get("moderationStatus")

    if current_status == "pending":
        raise HTTPException(
            status_code=400,
            detail="Video is already pending",
        )

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])

    film_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "moderationStatus": "pending",
                "visibility": "private",
                "status": (
                    "ready"
                    if current_status == "approved"
                    else video.get("status")
                ),
                "updatedAt": now,
            },
            "$push": {
                "moderationHistory": {
                    "action": "reset_to_pending",
                    "previousStatus": current_status,
                    "moderatedBy": moderator_id,
                    "moderatedAt": now,
                }
            },
        },
    )

    return {
        "message": "Video reset to pending",
        "videoId": video_id,
    }


# ============================================================
# AGE RESTRICTION
# ============================================================

@router.post("/videos/{video_id}/age-restriction")
def set_age_restriction(
    video_id: str,
    body: AgeRestrictionRequest,
    payload: dict = Depends(require_role("admin")),
):
    oid, video = _get_video_or_404(video_id)

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])

    film_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "ageRestricted": body.ageRestricted,
                "updatedAt": now,
            },
            "$push": {
                "moderationHistory": {
                    "action": (
                        "age_restriction_set"
                        if body.ageRestricted
                        else "age_restriction_cleared"
                    ),
                    "moderatedBy": moderator_id,
                    "moderatedAt": now,
                }
            },
        },
    )

    return {
        "message": "Age restriction updated",
        "videoId": video_id,
        "ageRestricted": body.ageRestricted,
    }


# ============================================================
# CONTENT WARNINGS
# ============================================================

@router.put("/videos/{video_id}/content-warnings")
def set_content_warnings(
    video_id: str,
    body: ContentWarningsRequest,
    payload: dict = Depends(require_role("admin")),
):
    oid, video = _get_video_or_404(video_id)

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])

    film_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "contentWarnings": body.contentWarnings,
                "updatedAt": now,
            },
            "$push": {
                "moderationHistory": {
                    "action": "content_warnings_updated",
                    "contentWarnings": body.contentWarnings,
                    "moderatedBy": moderator_id,
                    "moderatedAt": now,
                }
            },
        },
    )

    return {
        "message": "Content warnings updated",
        "videoId": video_id,
        "contentWarnings": body.contentWarnings,
    }


# ============================================================
# FEATURED
# ============================================================

@router.post("/videos/{video_id}/featured")
def set_featured(
    video_id: str,
    body: FeaturedRequest,
    payload: dict = Depends(require_role("admin")),
):
    oid, video = _get_video_or_404(video_id)

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])

    film_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "isFeatured": body.isFeatured,
                "updatedAt": now,
            },
            "$push": {
                "moderationHistory": {
                    "action": "featured_set" if body.isFeatured else "featured_cleared",
                    "moderatedBy": moderator_id,
                    "moderatedAt": now,
                }
            },
        },
    )

    return {
        "message": "Featured status updated",
        "videoId": video_id,
        "isFeatured": body.isFeatured,
    }


# ============================================================
# INTERNAL ADMIN NOTES
# ============================================================
# Deliberately separate from moderationComment, which is shown
# to the director on approve/reject. adminNotes is never read by
# viewer.py or director.py's serializers, so it stays internal
# as long as those keep using explicit field whitelists rather
# than dumping the raw doc.

@router.post("/videos/{video_id}/notes")
def add_admin_note(
    video_id: str,
    body: AdminNoteRequest,
    payload: dict = Depends(require_role("admin")),
):
    oid, video = _get_video_or_404(video_id)

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])

    note_entry = {
        "note": body.note,
        "addedBy": moderator_id,
        "addedAt": now,
    }

    film_collection.update_one(
        {"_id": oid},
        {"$push": {"adminNotes": note_entry}},
    )

    return {
        "message": "Note added",
        "videoId": video_id,
        "note": _serialize_mongo(note_entry),
    }


@router.get("/videos/{video_id}/notes")
def list_admin_notes(
    video_id: str,
    payload: dict = Depends(require_role("admin")),
):
    _, video = _get_video_or_404(video_id)
    notes = video.get("adminNotes", [])

    return {
        "videoId": video_id,
        "count": len(notes),
        "notes": [_serialize_mongo(n) for n in notes],
    }


# ============================================================
# BULK APPROVE / REJECT
# ============================================================

@router.post("/videos/bulk-approve")
def bulk_approve_videos(
    body: BulkApproveRequest,
    payload: dict = Depends(require_role("admin")),
):
    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])
    results = []

    for video_id in body.videoIds:
        try:
            oid, video = _get_video_or_404(video_id)
        except HTTPException as exc:
            results.append({"videoId": video_id, "success": False, "detail": exc.detail})
            continue

        if video.get("moderationStatus") == "approved":
            results.append({"videoId": video_id, "success": False, "detail": "Already approved"})
            continue

        history_entry = {
            "action": "approved",
            "comment": body.comment,
            "moderatedBy": moderator_id,
            "moderatedAt": now,
        }

        film_collection.update_one(
            {"_id": oid},
            {
                "$set": {
                    "moderationStatus": "approved",
                    "moderationComment": body.comment,
                    "moderatedBy": moderator_id,
                    "moderatedAt": now,
                    "status": "ready",
                    "visibility": "public",
                    "publishedAt": now,
                    "updatedAt": now,
                },
                "$push": {"moderationHistory": history_entry},
            },
        )

        for viewer in viewers_collection.find(
            {"newReleaseNotifications": {"$ne": False}},
            {"_id": 1},
        ):
            notifications_collection.insert_one(
                {
                    "viewerId": viewer["_id"],
                    "type": "new_release",
                    "title": "New film on Proscenium",
                    "message": (
                        f"{video.get('title', 'A new film')} "
                        "is now available to watch."
                    ),
                    "videoId": oid,
                    "read": False,
                    "createdAt": now,
                }
            )

        results.append({"videoId": video_id, "success": True})

    return {
        "message": "Bulk approve complete",
        "count": len(results),
        "results": results,
    }


@router.post("/videos/bulk-reject")
def bulk_reject_videos(
    body: BulkRejectRequest,
    payload: dict = Depends(require_role("admin")),
):
    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])
    results = []

    for video_id in body.videoIds:
        try:
            oid, video = _get_video_or_404(video_id)
        except HTTPException as exc:
            results.append({"videoId": video_id, "success": False, "detail": exc.detail})
            continue

        if video.get("moderationStatus") == "rejected":
            results.append({"videoId": video_id, "success": False, "detail": "Already rejected"})
            continue

        history_entry = {
            "action": "rejected",
            "comment": body.reason,
            "moderatedBy": moderator_id,
            "moderatedAt": now,
        }

        film_collection.update_one(
            {"_id": oid},
            {
                "$set": {
                    "moderationStatus": "rejected",
                    "moderationComment": body.reason,
                    "moderatedBy": moderator_id,
                    "moderatedAt": now,
                    "visibility": "private",
                    "updatedAt": now,
                },
                "$push": {"moderationHistory": history_entry},
            },
        )

        results.append({"videoId": video_id, "success": True})

    return {
        "message": "Bulk reject complete",
        "count": len(results),
        "results": results,
    }


# ============================================================
# COMMENT MODERATION
# ============================================================

def _refresh_moderation(collection, item: dict) -> dict:
    """Trust stored moderation fields on read.

    Moderation now runs only at write time (comment/review creation), not on
    every read. This avoids re-running text matching across the whole
    comments/reviews collection on every admin page load.
    """
    item.setdefault("moderationFlagged", bool(item.get("aiFlagged")))
    item.setdefault("moderationCategories", item.get("aiFlagCategories", []))
    item.setdefault("moderationMatchedTerms", [])
    item.setdefault("moderationLanguages", [])
    item.setdefault("moderationLanguageCodes", [])
    item.setdefault("moderationSeverity", "low")
    item.setdefault("moderationCheckFailed", item.get("aiCheckFailed", False))
    return item

def _serialize_admin_comment(c: dict) -> dict:
    c = _refresh_moderation(comments_collection, c)
    viewer = viewers_collection.find_one(
        {"_id": c.get("viewerId")},
        {"username": 1, "avatarUrl": 1},
    ) if c.get("viewerId") else None

    video = film_collection.find_one(
        {"_id": c.get("videoId")},
        {
            "title": 1,
            "directorId": 1,
            "thumbnailUrl": 1,
            "hlsManifestUrl": 1,
            "description": 1,
            "moderationStatus": 1,
            "status": 1,
        },
    ) if c.get("videoId") else None

    director = directors_collection.find_one(
        {"_id": video.get("directorId")},
        {"username": 1, "studioName": 1},
    ) if video and video.get("directorId") else None

    video_payload = None
    if video:
        video_payload = {
            "id": video.get("_id"),
            "title": video.get("title", "Untitled film"),
            "thumbnailUrl": video.get("thumbnailUrl"),
            "hlsManifestUrl": video.get("hlsManifestUrl"),
            "description": video.get("description"),
            "moderationStatus": video.get("moderationStatus"),
            "status": video.get("status"),
        }

    return _serialize_mongo({
        "id": c.get("_id"),
        "videoId": c.get("videoId"),
        "videoTitle": video.get("title", "Untitled film") if video else "Unknown film",
        "videoDescription": video.get("description", "") if video else "",
        "videoThumbnailUrl": video.get("thumbnailUrl") if video else None,
        "videoStreamUrl": video.get("hlsManifestUrl") if video else None,
        "video": video_payload,
        "viewerId": c.get("viewerId"),
        "viewerUsername": viewer.get("username", "Viewer") if viewer else "Viewer",
        "viewerAvatarUrl": viewer.get("avatarUrl") if viewer else None,
        "directorUsername": director.get("username") if director else None,
        "text": c.get("text", ""),
        "parentId": c.get("parentId"),
        "moderationStatus": c.get("moderationStatus", "visible"),
        "moderationFlagged": bool(c.get("moderationFlagged") or c.get("aiFlagged")),
        "moderationCategories": c.get("moderationCategories", c.get("aiFlagCategories", [])),
        "moderationMatchedTerms": c.get("moderationMatchedTerms", []),
        "moderationLanguages": c.get("moderationLanguages", []),
        "moderationLanguageCodes": c.get("moderationLanguageCodes", []),
        "moderationSeverity": c.get("moderationSeverity", "low"),
        "moderationCheckFailed": c.get("moderationCheckFailed", c.get("aiCheckFailed", False)),
        "moderatedBy": c.get("moderatedBy"),
        "moderatedAt": c.get("moderatedAt"),
        "moderationHistory": c.get("moderationHistory", []),
        "createdAt": c.get("createdAt"),
        "updatedAt": c.get("updatedAt"),
    })


def _serialize_admin_review(review: dict) -> dict:
    review = _refresh_moderation(video_reviews_collection, review)
    viewer = viewers_collection.find_one(
        {"_id": review.get("viewerId")},
        {"username": 1, "avatarUrl": 1},
    ) if review.get("viewerId") else None

    video = film_collection.find_one(
        {"_id": review.get("videoId")},
        {"title": 1, "description": 1, "thumbnailUrl": 1, "hlsManifestUrl": 1, "directorId": 1},
    ) if review.get("videoId") else None

    director = directors_collection.find_one(
        {"_id": video.get("directorId")},
        {"username": 1, "studioName": 1},
    ) if video and video.get("directorId") else None

    return _serialize_mongo({
        "id": review.get("_id"),
        "videoId": review.get("videoId"),
        "videoTitle": video.get("title", "Untitled film") if video else "Unknown film",
        "videoDescription": video.get("description", "") if video else "",
        "videoThumbnailUrl": video.get("thumbnailUrl") if video else None,
        "videoStreamUrl": video.get("hlsManifestUrl") if video else None,
        "viewerId": review.get("viewerId"),
        "viewerUsername": viewer.get("username", "Viewer") if viewer else "Viewer",
        "viewerAvatarUrl": viewer.get("avatarUrl") if viewer else None,
        "directorId": video.get("directorId") if video else None,
        "directorUsername": director.get("username") if director else None,
        "rating": float(review.get("rating", 0) or 0),
        "text": review.get("text", ""),
        "moderationStatus": review.get("moderationStatus", "visible"),
        "moderationFlagged": bool(review.get("moderationFlagged") or review.get("aiFlagged")),
        "moderationCategories": review.get("moderationCategories", review.get("aiFlagCategories", [])),
        "moderationMatchedTerms": review.get("moderationMatchedTerms", []),
        "moderationLanguages": review.get("moderationLanguages", []),
        "moderationLanguageCodes": review.get("moderationLanguageCodes", []),
        "moderationSeverity": review.get("moderationSeverity", "low"),
        "moderationCheckFailed": review.get("moderationCheckFailed", review.get("aiCheckFailed", False)),
        "moderatedBy": review.get("moderatedBy"),
        "moderatedAt": review.get("moderatedAt"),
        "moderationHistory": review.get("moderationHistory", []),
        "createdAt": review.get("createdAt"),
        "updatedAt": review.get("updatedAt"),
    })


@router.get("/feedback/flagged")
def get_flagged_feedback_summary(
    payload: dict = Depends(require_role("admin")),
):
    """Return the live flagged-feedback totals used by the Admin dashboard.

    This endpoint intentionally does not accept a video id. It scans comments
    and reviews directly, refreshes moderation metadata, and ignores orphaned
    records so one malformed feedback document cannot break the dashboard.
    """
    flagged_comments, flagged_reviews = _current_flagged_feedback()
    return {
        "comments": len(flagged_comments),
        "reviews": len(flagged_reviews),
        "count": len(flagged_comments) + len(flagged_reviews),
    }


@router.get("/reviews")
def list_admin_reviews(
    status: str = Query("all"),
    video_id: str | None = Query(None),
    payload: dict = Depends(require_role("admin")),
):
    allowed = {"all", "flagged", "visible", "removed", "auto_hidden", "hidden"}
    if status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(allowed)}")

    query = {}
    if status != "all" and status != "flagged":
        query["moderationStatus"] = status

    if video_id:
        try:
            query["videoId"] = ObjectId(video_id)
        except (InvalidId, TypeError):
            raise HTTPException(status_code=400, detail="Invalid video id")

    reviews = list(
        video_reviews_collection.find(query)
        .sort("updatedAt", -1)
    )
    serialized = [_serialize_admin_review(r) for r in reviews]
    if status == "flagged":
        serialized = [item for item in serialized if item.get("moderationFlagged")]
    return {"count": len(serialized), "reviews": serialized}


@router.get("/reviews/flagged")
def list_flagged_reviews(
    payload: dict = Depends(require_role("admin")),
):
    return list_admin_reviews(status="flagged", payload=payload)


def _serialize_feedback_item(item: dict, kind: str) -> dict:
    serialized = (
        _serialize_admin_comment(item)
        if kind == "comment"
        else _serialize_admin_review(item)
    )
    serialized["feedbackType"] = kind
    serialized["isFlagged"] = bool(
        item.get("moderationFlagged") or item.get("aiFlagged")
    )
    return serialized


@router.get("/videos/{video_id}/feedback")
def list_video_feedback(
    video_id: str,
    payload: dict = Depends(require_role("admin")),
):
    oid, _ = _get_video_or_404(video_id)

    comments = list(comments_collection.find({"videoId": oid}).sort("createdAt", -1))
    reviews = list(video_reviews_collection.find({"videoId": oid}).sort("updatedAt", -1))

    items = [
        _serialize_feedback_item(item, "comment")
        for item in comments
    ] + [
        _serialize_feedback_item(item, "review")
        for item in reviews
    ]

    # Flagged feedback always comes first. Within each group, newest first.
    items.sort(
        key=lambda item: (
            0 if item.get("isFlagged") else 1,
            item.get("updatedAt") or item.get("createdAt") or "",
        )
    )
    return {
        "videoId": video_id,
        "count": len(items),
        "flaggedCount": sum(1 for item in items if item.get("isFlagged")),
        "feedback": items,
    }


@router.get("/comments")
def list_comments(
    status: str = Query("all"),
    video_id: str | None = Query(None),
    payload: dict = Depends(require_role("admin")),
):
    allowed = {"all", "flagged", "visible", "removed", "auto_hidden"}
    if status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(allowed)}")

    query = {}
    if status != "all" and status != "flagged":
        query["moderationStatus"] = status

    if video_id:
        try:
            query["videoId"] = ObjectId(video_id)
        except (InvalidId, TypeError):
            raise HTTPException(status_code=400, detail="Invalid video id")

    comments = list(
        comments_collection.find(query)
        .sort("createdAt", -1)
    )

    serialized = [_serialize_admin_comment(c) for c in comments]
    if status == "flagged":
        serialized = [item for item in serialized if item.get("moderationFlagged")]
    return {"count": len(serialized), "comments": serialized}


@router.get("/comments/flagged")
def list_flagged_comments(
    payload: dict = Depends(require_role("admin")),
):
    # Show every comment that is currently flagged, including legacy
    # comments that were flagged by the older aiFlagged field.
    # Do not use a permanent "ever flagged" field: editing a comment
    # re-runs moderation and a clean edit should leave this queue.
    comments = list(
        comments_collection.find({})
        .sort("createdAt", -1)
    )

    serialized = [_serialize_admin_comment(c) for c in comments]
    serialized = [item for item in serialized if item.get("moderationFlagged")]
    return {"count": len(serialized), "comments": serialized}


def _comment_thread_ids(root_id: ObjectId) -> list[ObjectId]:
    ids = [root_id]
    frontier = [root_id]
    while frontier:
        children = list(
            comments_collection.find(
                {"parentId": {"$in": frontier}},
                {"_id": 1},
            )
        )
        child_ids = [c["_id"] for c in children]
        if not child_ids:
            break
        ids.extend(child_ids)
        frontier = child_ids
    return ids


@router.post("/comments/{comment_id}/restore")
def restore_comment(
    comment_id: str,
    payload: dict = Depends(require_role("admin")),
):
    try:
        oid = ObjectId(comment_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid comment id")

    comment = comments_collection.find_one({"_id": oid})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])
    result = comments_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "moderationStatus": "visible",
                "moderatedBy": moderator_id,
                "moderatedAt": now,
            },
            "$push": {
                "moderationHistory": {
                    "action": "restored_by_admin",
                    "moderatedBy": moderator_id,
                    "moderatedAt": now,
                }
            },
        },
    )

    if result.modified_count and comment.get("moderationStatus") == "removed":
        film_collection.update_one(
            {"_id": comment["videoId"]},
            {"$inc": {"commentCount": 1}},
        )

    return {"message": "Comment restored", "commentId": comment_id}


@router.post("/comments/{comment_id}/remove")
def admin_remove_comment(
    comment_id: str,
    payload: dict = Depends(require_role("admin")),
):
    try:
        oid = ObjectId(comment_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid comment id")

    comment = comments_collection.find_one({"_id": oid})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.get("moderationStatus") == "removed":
        return {"message": "Comment already removed", "commentId": comment_id}

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])
    result = comments_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "moderationStatus": "removed",
                "moderatedBy": moderator_id,
                "moderatedAt": now,
            },
            "$push": {
                "moderationHistory": {
                    "action": "removed_by_admin",
                    "moderatedBy": moderator_id,
                    "moderatedAt": now,
                }
            },
        },
    )

    if result.modified_count and comment.get("moderationStatus", "visible") == "visible":
        film_collection.update_one(
            {"_id": comment["videoId"]},
            {"$inc": {"commentCount": -1}},
        )

    return {"message": "Comment removed", "commentId": comment_id}


def _recalculate_review_stats(video_id):
    stats = list(video_reviews_collection.aggregate([
        {"$match": {"videoId": video_id, "moderationStatus": {"$ne": "removed"}}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]))
    avg = round(float(stats[0]["avg"]), 1) if stats else 0.0
    count = int(stats[0]["count"]) if stats else 0
    film_collection.update_one(
        {"_id": video_id},
        {"$set": {"avgRating": avg, "reviewCount": count}},
    )
    return avg, count


@router.post("/reviews/{review_id}/restore")
def restore_review(
    review_id: str,
    payload: dict = Depends(require_role("admin")),
):
    try:
        oid = ObjectId(review_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid review id")

    review = video_reviews_collection.find_one({"_id": oid})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])
    video_id = review.get("videoId")

    video_reviews_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "moderationStatus": "visible",
                "moderatedBy": moderator_id,
                "moderatedAt": now,
            },
            "$push": {
                "moderationHistory": {
                    "action": "restored_by_admin",
                    "moderatedBy": moderator_id,
                    "moderatedAt": now,
                }
            },
        },
    )

    if video_id:
        _recalculate_review_stats(video_id)

    return {"message": "Review restored", "reviewId": review_id}


@router.post("/reviews/{review_id}/remove")
def admin_remove_review(
    review_id: str,
    payload: dict = Depends(require_role("admin")),
):
    try:
        oid = ObjectId(review_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid review id")

    review = video_reviews_collection.find_one({"_id": oid})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.get("moderationStatus") == "removed":
        return {"message": "Review already removed", "reviewId": review_id}

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])
    video_id = review.get("videoId")

    video_reviews_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "moderationStatus": "removed",
                "moderatedBy": moderator_id,
                "moderatedAt": now,
            },
            "$push": {
                "moderationHistory": {
                    "action": "removed_by_admin",
                    "moderatedBy": moderator_id,
                    "moderatedAt": now,
                }
            },
        },
    )

    if video_id:
        _recalculate_review_stats(video_id)

    return {"message": "Review removed", "reviewId": review_id}


# ============================================================
# DIRECTOR DETAIL + MODERATION
# ============================================================

@router.get("/directors/{director_id}")
def get_director_detail(
    director_id: str,
    payload: dict = Depends(require_role("admin")),
):
    try:
        oid = ObjectId(director_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid director id")

    director = directors_collection.find_one({"_id": oid})
    if not director:
        raise HTTPException(status_code=404, detail="Director not found")

    videos = list(film_collection.find({"directorId": oid}).sort("uploadedAt", -1))

    return {
        "director": _serialize_mongo(director),
        "videoCount": len(videos),
        "videos": [_serialize_video(v) for v in videos],
    }


@router.post("/directors/{director_id}/suspend")
def suspend_director(
    director_id: str,
    body: DirectorSuspendRequest,
    payload: dict = Depends(require_role("admin")),
):
    try:
        oid = ObjectId(director_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid director id")

    director = directors_collection.find_one({"_id": oid})
    if not director:
        raise HTTPException(status_code=404, detail="Director not found")

    if director.get("accountStatus") == "suspended":
        raise HTTPException(status_code=400, detail="Director is already suspended")

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])

    directors_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "accountStatus": "suspended",
                "updatedAt": now,
            },
            "$push": {
                "moderationHistory": {
                    "action": "suspended",
                    "reason": body.reason,
                    "moderatedBy": moderator_id,
                    "moderatedAt": now,
                }
            },
        },
    )

    return {
        "message": "Director suspended",
        "directorId": director_id,
        "reason": body.reason,
    }


@router.post("/directors/{director_id}/unsuspend")
def unsuspend_director(
    director_id: str,
    payload: dict = Depends(require_role("admin")),
):
    try:
        oid = ObjectId(director_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid director id")

    director = directors_collection.find_one({"_id": oid})
    if not director:
        raise HTTPException(status_code=404, detail="Director not found")

    if director.get("accountStatus") != "suspended":
        raise HTTPException(status_code=400, detail="Director is not suspended")

    now = datetime.utcnow()
    moderator_id = ObjectId(payload["user_id"])

    directors_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "accountStatus": "active",
                "updatedAt": now,
            },
            "$push": {
                "moderationHistory": {
                    "action": "unsuspended",
                    "moderatedBy": moderator_id,
                    "moderatedAt": now,
                }
            },
        },
    )

    return {
        "message": "Director reinstated",
        "directorId": director_id,
    }