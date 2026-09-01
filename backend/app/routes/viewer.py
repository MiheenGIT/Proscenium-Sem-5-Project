from datetime import datetime
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from database import (
    comments_collection,
    film_collection,
    viewers_collection,
    video_reactions_collection,
    video_views_collection,
    cast_collection,
    watch_history_collection,
    watch_sessions_collection,
    watchlist_collection,
)
from models.schemas import (
    AvatarUpdateRequest,
    BioUpdateRequest,
    CommentCreateRequest,
    HeartbeatRequest,
    ReactionRequest,
    ViewerProfileUpdateRequest,
)
from utils.cloudinary_helpers import upload_avatar
from utils.security import require_role

router = APIRouter(prefix="/viewer", tags=["viewer"])

# The existing project stores the viewer's current anti-fraud watch session
# separately from persistent history. These collections are deliberately kept
# independent so restarting a film does not erase the viewer's history.
try:
    watch_history_collection.create_index([("viewerId", 1), ("videoId", 1)], unique=True)
    watchlist_collection.create_index([("viewerId", 1), ("videoId", 1)], unique=True)
    video_reactions_collection.create_index([("viewerId", 1), ("videoId", 1)], unique=True)
except Exception:
    # Index creation should not prevent the API from starting if MongoDB is
    # temporarily unavailable; normal database operations will report errors.
    pass


class WatchlistRequest(BaseModel):
    saved: bool = True


def _viewer_oid(payload: dict) -> ObjectId:
    try:
        return ObjectId(payload["user_id"])
    except (InvalidId, TypeError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid authenticated viewer")


def _viewer_or_404(payload: dict) -> dict:
    oid = _viewer_oid(payload)
    viewer = viewers_collection.find_one({"_id": oid})
    if not viewer:
        raise HTTPException(status_code=401, detail="Viewer account not found")
    if viewer.get("isBanned"):
        raise HTTPException(status_code=403, detail="Your viewer account is banned")
    return viewer


def _get_public_video_or_404(video_id: str):
    try:
        oid = ObjectId(video_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid video id")

    video = film_collection.find_one({"_id": oid})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # This is the security boundary: unapproved/private films never leave the
    # backend, even if a viewer guesses an ID or calls an endpoint directly.
    if video.get("moderationStatus") != "approved" or video.get("visibility") != "public":
        raise HTTPException(status_code=404, detail="Video not found")

    return oid, video


def _maturity_filter(payload: dict) -> dict:
    viewer = _viewer_or_404(payload)
    if viewer.get("maturitySetting", "all") == "mature":
        return {}
    return {"ageRestricted": {"$ne": True}}


def _serialize_summary(video: dict) -> dict:
    return {
        "id": str(video["_id"]),
        "title": video.get("title", "Untitled"),
        "description": video.get("description"),
        "thumbnailUrl": video.get("thumbnailUrl"),
        "genres": video.get("genres", []),
        "tags": video.get("tags", []),
        "language": video.get("language"),
        "durationSec": video.get("durationSec", 0),
        "ageRestricted": video.get("ageRestricted", False),
        "avgRating": video.get("avgRating", 0),
        "views": video.get("views", 0),
        "likes": video.get("likes", 0),
        "dislikes": video.get("dislikes", 0),
        "commentCount": video.get("commentCount", 0),
        "publishedAt": video.get("publishedAt"),
    }


def _serialize_profile(viewer: dict) -> dict:
    return {
        "id": str(viewer["_id"]),
        "viewerId": str(viewer["_id"]),
        "username": viewer.get("username", ""),
        "email": viewer.get("email", ""),
        "date_of_birth": viewer.get("date_of_birth"),
        "bio": viewer.get("bio"),
        "genrePreferences": viewer.get("genrePreferences", []),
        "maturitySetting": viewer.get("maturitySetting", "all"),
        "avatarUrl": viewer.get("avatarUrl"),
        "role": "viewer",
        "createdAt": viewer.get("createdAt"),
        "updatedAt": viewer.get("updatedAt"),
    }


def _get_unique_views(video_id: ObjectId) -> int:
    return video_views_collection.count_documents({"videoId": video_id})


# ---------------- Browse / search ----------------

@router.get("/videos")
def browse_videos(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    genre: Optional[str] = Query(None),
    payload: dict = Depends(require_role("viewer")),
):
    query = {"moderationStatus": "approved", "visibility": "public"}
    query.update(_maturity_filter(payload))
    if genre:
        query["genres"] = {"$regex": f"^{genre.strip()}$", "$options": "i"}

    skip = (page - 1) * limit
    total = film_collection.count_documents(query)
    videos = list(
        film_collection.find(query)
        .sort("publishedAt", -1)
        .skip(skip)
        .limit(limit)
    )
    return {"count": total, "page": page, "limit": limit, "videos": [_serialize_summary(v) for v in videos]}


@router.get("/genres")
def list_genres(payload: dict = Depends(require_role("viewer"))):
    query = {"moderationStatus": "approved", "visibility": "public"}
    query.update(_maturity_filter(payload))
    genres = film_collection.distinct("genres", query)
    return {"genres": sorted({str(g).strip() for g in genres if str(g).strip()}, key=str.lower)}


@router.get("/videos/search")
def search_videos(
    q: str = Query(..., min_length=1, max_length=100),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    genre: Optional[str] = Query(None),
    payload: dict = Depends(require_role("viewer")),
):
    # Escape regex metacharacters so a title search cannot accidentally become
    # an arbitrary regex. MongoDB still performs case-insensitive partial title matching.
    import re

    query = {
        "moderationStatus": "approved",
        "visibility": "public",
        "title": {"$regex": re.escape(q.strip()), "$options": "i"},
    }
    query.update(_maturity_filter(payload))
    if genre:
        query["genres"] = {"$regex": f"^{re.escape(genre.strip())}$", "$options": "i"}

    skip = (page - 1) * limit
    total = film_collection.count_documents(query)
    videos = list(film_collection.find(query).sort("publishedAt", -1).skip(skip).limit(limit))
    return {
        "count": total,
        "page": page,
        "limit": limit,
        "query": q,
        "genre": genre,
        "videos": [_serialize_summary(v) for v in videos],
    }


# ---------------- Video detail / playback ----------------

@router.get("/videos/{video_id}")
def get_video_detail(video_id: str, payload: dict = Depends(require_role("viewer"))):
    oid, video = _get_public_video_or_404(video_id)
    viewer = _viewer_or_404(payload)
    if video.get("ageRestricted") and viewer.get("maturitySetting", "all") != "mature":
        raise HTTPException(status_code=403, detail="Content restricted by maturity setting")

    reaction = video_reactions_collection.find_one({"videoId": oid, "viewerId": viewer["_id"]})
    saved = watchlist_collection.find_one({"videoId": oid, "viewerId": viewer["_id"]}) is not None

    return {
        "id": str(video["_id"]),
        "title": video.get("title"),
        "description": video.get("description"),
        "thumbnailUrl": video.get("thumbnailUrl"),
        "genres": video.get("genres", []),
        "cast": [
            {"id": str(c["_id"]), "name": c.get("name", ""), "characterName": c.get("characterName", ""), "photoUrl": c.get("photoUrl")}
            for c in cast_collection.find({"videoId": oid})
        ],
        "tags": video.get("tags", []),
        "language": video.get("language"),
        "durationSec": video.get("durationSec", 0),
        "releaseYear": video.get("releaseYear"),
        "productionCountry": video.get("productionCountry"),
        "ageRestricted": video.get("ageRestricted", False),
        "contentWarnings": video.get("contentWarnings", []),
        "avgRating": video.get("avgRating", 0),
        "reviewCount": video.get("reviewCount", 0),
        "views": video.get("views", 0),
        "uniqueViews": _get_unique_views(video["_id"]),
        "likes": video.get("likes", 0),
        "dislikes": video.get("dislikes", 0),
        "commentCount": video.get("commentCount", 0),
        "publishedAt": video.get("publishedAt"),
        "reaction": reaction.get("type") if reaction else None,
        "saved": saved,
    }


@router.get("/videos/{video_id}/watch")
def watch_video(video_id: str, payload: dict = Depends(require_role("viewer"))):
    oid, video = _get_public_video_or_404(video_id)
    viewer = _viewer_or_404(payload)
    if video.get("ageRestricted") and viewer.get("maturitySetting", "all") != "mature":
        raise HTTPException(status_code=403, detail="Content restricted by maturity setting")

    now = datetime.utcnow()
    watch_sessions_collection.update_one(
        {"videoId": oid, "viewerId": viewer["_id"]},
        {"$set": {
            "accumulatedSeconds": 0.0,
            "lastHeartbeatAt": now,
            "lastReportedTimeSec": 0.0,
            "counted": False,
        }},
        upsert=True,
    )

    history = watch_history_collection.find_one({"videoId": oid, "viewerId": viewer["_id"]})
    return {
        "title": video.get("title"),
        "stream_url": video.get("hlsManifestUrl"),
        "resumeTimeSec": float(history.get("currentTimeSec", 0)) if history else 0.0,
    }


HEARTBEAT_MAX_GAP_SECONDS = 15
VIEW_THRESHOLD_FRACTION = 0.75
PLAYBACK_DRIFT_TOLERANCE = 5


@router.post("/videos/{video_id}/heartbeat")
def watch_heartbeat(
    video_id: str,
    body: HeartbeatRequest,
    payload: dict = Depends(require_role("viewer")),
):
    oid, video = _get_public_video_or_404(video_id)
    viewer = _viewer_or_404(payload)
    duration = float(video.get("durationSec", 0) or 0)
    now = datetime.utcnow()
    current = min(max(float(body.currentTimeSec), 0), duration if duration else float(body.currentTimeSec))

    # Persistent resume/history state. This is intentionally independent from
    # the anti-fraud view-counting session.
    history_doc = {
        "viewerId": viewer["_id"],
        "videoId": oid,
        "currentTimeSec": current,
        "durationSec": duration,
        "progress": (current / duration) if duration else 0,
        "completed": bool(duration and current >= duration * 0.95),
        "lastWatchedAt": now,
        "updatedAt": now,
    }
    watch_history_collection.update_one(
        {"viewerId": viewer["_id"], "videoId": oid},
        {"$set": history_doc, "$setOnInsert": {"startedAt": now}},
        upsert=True,
    )

    if not duration:
        return {"counted": False, "reason": "duration unknown", "currentTimeSec": current}

    session = watch_sessions_collection.find_one({"videoId": oid, "viewerId": viewer["_id"]})
    if session is None:
        watch_sessions_collection.insert_one({
            "videoId": oid,
            "viewerId": viewer["_id"],
            "accumulatedSeconds": 0.0,
            "lastHeartbeatAt": now,
            "lastReportedTimeSec": current,
            "counted": False,
        })
        return {"counted": False, "accumulatedSeconds": 0.0, "currentTimeSec": current}

    if session.get("counted"):
        return {"counted": True, "accumulatedSeconds": session.get("accumulatedSeconds", 0), "currentTimeSec": current}

    wall_clock_gap = max(0, min((now - session["lastHeartbeatAt"]).total_seconds(), HEARTBEAT_MAX_GAP_SECONDS))
    reported_advance = current - session.get("lastReportedTimeSec", current)
    drift = abs(reported_advance - wall_clock_gap)
    credited_gap = wall_clock_gap if reported_advance >= 0 and drift <= PLAYBACK_DRIFT_TOLERANCE else 0

    new_accumulated = session.get("accumulatedSeconds", 0) + credited_gap
    just_crossed_threshold = (new_accumulated / duration) >= VIEW_THRESHOLD_FRACTION

    watch_sessions_collection.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "accumulatedSeconds": new_accumulated,
            "lastHeartbeatAt": now,
            "lastReportedTimeSec": current,
            "counted": just_crossed_threshold,
        }},
    )

    if just_crossed_threshold:
        try:
            video_views_collection.insert_one({"videoId": oid, "viewerId": viewer["_id"], "firstWatchedAt": now})
            film_collection.update_one({"_id": oid}, {"$inc": {"views": 1, "uniqueViews": 1}})
        except DuplicateKeyError:
            film_collection.update_one({"_id": oid}, {"$inc": {"views": 1}})

    return {"counted": just_crossed_threshold, "accumulatedSeconds": new_accumulated, "currentTimeSec": current}


# ---------------- Comments ----------------

def _serialize_comment(comment: dict) -> dict:
    viewer = viewers_collection.find_one(
        {"_id": comment["viewerId"]},
        {"username": 1, "avatarUrl": 1},
    )
    return {
        "id": str(comment["_id"]),
        "videoId": str(comment["videoId"]),
        "viewerId": str(comment["viewerId"]),
        "viewerUsername": viewer.get("username", "Viewer") if viewer else "Viewer",
        "viewerAvatarUrl": viewer.get("avatarUrl") if viewer else None,
        "text": comment["text"],
        "parentId": str(comment["parentId"]) if comment.get("parentId") else None,
        "replyIds": [str(r) for r in comment.get("replyIds", [])],
        "createdAt": comment.get("createdAt"),
        "updatedAt": comment.get("updatedAt"),
        "moderationStatus": comment.get("moderationStatus", "visible"),
    }


@router.post("/videos/{video_id}/comments")
def add_comment(video_id: str, body: CommentCreateRequest, payload: dict = Depends(require_role("viewer"))):
    oid, _ = _get_public_video_or_404(video_id)
    viewer = _viewer_or_404(payload)
    moderation = {
        "flagged": False,
        "categories": [],
        "checkFailed": False,
    }
    now = datetime.utcnow()
    comment_doc = {
        "videoId": oid,
        "viewerId": viewer["_id"],
        "text": body.text.strip(),
        "parentId": None,
        "replyIds": [],
        "createdAt": now,
        "updatedAt": now,
        "moderationStatus": "visible",
        "aiFlagged": False,
        "aiFlagCategories": [],
        "aiCheckFailed": False,
        "moderatedBy": None,
        "moderatedAt": None,
        "moderationHistory": [],
    }
    result = comments_collection.insert_one(comment_doc)
    comment_doc["_id"] = result.inserted_id
    film_collection.update_one({"_id": oid}, {"$inc": {"commentCount": 1}})
    return _serialize_comment(comment_doc)


@router.post("/videos/{video_id}/comments/{comment_id}/reply")
def reply_to_comment(
    video_id: str,
    comment_id: str,
    body: CommentCreateRequest,
    payload: dict = Depends(require_role("viewer")),
):
    try:
        video_oid = ObjectId(video_id)
        parent_oid = ObjectId(comment_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid id")
    _get_public_video_or_404(video_id)
    parent = comments_collection.find_one({"_id": parent_oid, "videoId": video_oid, "moderationStatus": {"$ne": "auto_hidden"}})
    if not parent:
        raise HTTPException(status_code=404, detail="Comment not found")

    viewer = _viewer_or_404(payload)
    moderation = {
        "flagged": False,
        "categories": [],
        "checkFailed": False,
    }
    now = datetime.utcnow()
    reply_doc = {
        "videoId": video_oid,
        "viewerId": viewer["_id"],
        "text": body.text.strip(),
        "parentId": parent_oid,
        "replyIds": [],
        "createdAt": now,
        "updatedAt": now,
        "moderationStatus": "visible",
        "aiFlagged": False,
        "aiFlagCategories": [],
        "aiCheckFailed": False,
        "moderatedBy": None,
        "moderatedAt": None,
        "moderationHistory": [],
    }
    result = comments_collection.insert_one(reply_doc)
    reply_doc["_id"] = result.inserted_id
    comments_collection.update_one({"_id": parent_oid}, {"$push": {"replyIds": reply_doc["_id"]}})
    film_collection.update_one({"_id": video_oid}, {"$inc": {"commentCount": 1}})
    return _serialize_comment(reply_doc)


@router.get("/videos/{video_id}/comments")
def list_comments(
    video_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    payload: dict = Depends(require_role("viewer")),
):
    oid, _ = _get_public_video_or_404(video_id)
    query = {"videoId": oid, "parentId": None, "moderationStatus": {"$ne": "auto_hidden"}}
    skip = (page - 1) * limit
    total = comments_collection.count_documents(query)
    comments = list(comments_collection.find(query).sort("createdAt", -1).skip(skip).limit(limit))
    return {"count": total, "page": page, "limit": limit, "comments": [_serialize_comment(c) for c in comments]}


@router.get("/videos/{video_id}/comments/{comment_id}/replies")
def list_replies(
    video_id: str,
    comment_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=100),
    payload: dict = Depends(require_role("viewer")),
):
    try:
        video_oid = ObjectId(video_id)
        parent_oid = ObjectId(comment_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid id")
    _get_public_video_or_404(video_id)
    query = {"videoId": video_oid, "parentId": parent_oid, "moderationStatus": {"$ne": "auto_hidden"}}
    total = comments_collection.count_documents(query)
    replies = list(comments_collection.find(query).sort("createdAt", 1).skip((page - 1) * limit).limit(limit))
    return {"count": total, "page": page, "limit": limit, "replies": [_serialize_comment(r) for r in replies]}


def _collect_descendant_ids(comment_id: ObjectId) -> list[ObjectId]:
    all_ids = []
    frontier = [comment_id]
    while frontier:
        children = list(comments_collection.find({"parentId": {"$in": frontier}}, {"_id": 1}))
        child_ids = [c["_id"] for c in children]
        all_ids.extend(child_ids)
        frontier = child_ids
    return all_ids


@router.put("/videos/{video_id}/comments/{comment_id}")
def edit_comment(
    video_id: str,
    comment_id: str,
    body: CommentCreateRequest,
    payload: dict = Depends(require_role("viewer")),
):
    try:
        video_oid = ObjectId(video_id)
        comment_oid = ObjectId(comment_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid id")
    _get_public_video_or_404(video_id)
    viewer = _viewer_or_404(payload)
    comment = comments_collection.find_one({"_id": comment_oid, "videoId": video_oid})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment["viewerId"] != viewer["_id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own comment")
    moderation = {
        "flagged": False,
        "categories": [],
        "checkFailed": False,
    }
    now = datetime.utcnow()
    comments_collection.update_one(
        {"_id": comment_oid},
        {"$set": {"text": body.text.strip(), "updatedAt": now, "moderationStatus": "visible", "aiFlagged": False, "aiFlagCategories": moderation.get("categories", [])}},
    )
    updated = comments_collection.find_one({"_id": comment_oid})
    return _serialize_comment(updated)


@router.delete("/videos/{video_id}/comments/{comment_id}")
def delete_comment(video_id: str, comment_id: str, payload: dict = Depends(require_role("viewer"))):
    try:
        video_oid = ObjectId(video_id)
        comment_oid = ObjectId(comment_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid id")
    _get_public_video_or_404(video_id)
    viewer = _viewer_or_404(payload)
    comment = comments_collection.find_one({"_id": comment_oid, "videoId": video_oid})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment["viewerId"] != viewer["_id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own comment")

    descendants = _collect_descendant_ids(comment_oid)
    all_ids = [comment_oid] + descendants
    comments_collection.delete_many({"_id": {"$in": all_ids}})
    if comment.get("parentId"):
        comments_collection.update_one({"_id": comment["parentId"]}, {"$pull": {"replyIds": comment_oid}})
    film_collection.update_one({"_id": video_oid}, {"$inc": {"commentCount": -len(all_ids)}})
    return {"message": "Comment deleted", "commentId": comment_id, "removedCount": len(all_ids)}


# ---------------- Reactions ----------------

@router.post("/videos/{video_id}/react")
def react_to_video(video_id: str, body: ReactionRequest, payload: dict = Depends(require_role("viewer"))):
    oid, _ = _get_public_video_or_404(video_id)
    viewer = _viewer_or_404(payload)
    existing = video_reactions_collection.find_one({"videoId": oid, "viewerId": viewer["_id"]})

    if existing and existing["type"] == body.type:
        video_reactions_collection.delete_one({"_id": existing["_id"]})
    elif existing:
        video_reactions_collection.update_one({"_id": existing["_id"]}, {"$set": {"type": body.type}})
    else:
        try:
            video_reactions_collection.insert_one({"videoId": oid, "viewerId": viewer["_id"], "type": body.type})
        except DuplicateKeyError:
            video_reactions_collection.update_one({"videoId": oid, "viewerId": viewer["_id"]}, {"$set": {"type": body.type}})

    # Recompute counters from the reaction collection. This avoids drift if an
    # earlier request was retried or a client was disconnected mid-operation.
    likes = video_reactions_collection.count_documents({"videoId": oid, "type": "like"})
    dislikes = video_reactions_collection.count_documents({"videoId": oid, "type": "dislike"})
    film_collection.update_one({"_id": oid}, {"$set": {"likes": likes, "dislikes": dislikes}})
    current = video_reactions_collection.find_one({"videoId": oid, "viewerId": viewer["_id"]})
    return {
        "message": "Reaction updated",
        "videoId": video_id,
        "reaction": current.get("type") if current else None,
        "likes": likes,
        "dislikes": dislikes,
    }


# ---------------- Watch history ----------------


@router.get("/history")
def get_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    payload: dict = Depends(require_role("viewer")),
):
    viewer = _viewer_or_404(payload)
    rows = list(watch_history_collection.find({"viewerId": viewer["_id"]}).sort("lastWatchedAt", -1).skip((page - 1) * limit).limit(limit))
    videos = []
    for row in rows:
        video = film_collection.find_one({"_id": row["videoId"], "moderationStatus": "approved", "visibility": "public"})
        if not video:
            continue
        item = _serialize_summary(video)
        item.update({
            "currentTimeSec": row.get("currentTimeSec", 0),
            "progress": row.get("progress", 0),
            "completed": row.get("completed", False),
            "lastWatchedAt": row.get("lastWatchedAt"),
        })
        videos.append(item)
    total = watch_history_collection.count_documents({"viewerId": viewer["_id"]})
    return {"count": total, "page": page, "limit": limit, "videos": videos}


@router.delete("/history")
def clear_history(payload: dict = Depends(require_role("viewer"))):
    viewer = _viewer_or_404(payload)
    result = watch_history_collection.delete_many({"viewerId": viewer["_id"]})
    return {"message": "Watch history cleared", "removedCount": result.deleted_count}


# ---------------- Watchlist ----------------

@router.get("/watchlist")
def get_watchlist(payload: dict = Depends(require_role("viewer"))):
    viewer = _viewer_or_404(payload)
    rows = list(watchlist_collection.find({"viewerId": viewer["_id"]}).sort("savedAt", -1))
    videos = []
    for row in rows:
        video = film_collection.find_one({"_id": row["videoId"], "moderationStatus": "approved", "visibility": "public"})
        if video:
            videos.append(_serialize_summary(video))
    return {"count": len(videos), "videos": videos}


@router.post("/videos/{video_id}/watchlist")
def toggle_watchlist(video_id: str, body: WatchlistRequest, payload: dict = Depends(require_role("viewer"))):
    oid, _ = _get_public_video_or_404(video_id)
    viewer = _viewer_or_404(payload)
    existing = watchlist_collection.find_one({"viewerId": viewer["_id"], "videoId": oid})
    if existing:
        watchlist_collection.delete_one({"_id": existing["_id"]})
        return {"saved": False, "videoId": video_id}
    watchlist_collection.insert_one({"viewerId": viewer["_id"], "videoId": oid, "savedAt": datetime.utcnow()})
    return {"saved": True, "videoId": video_id}


# ---------------- Profile ----------------

@router.get("/profile")
def get_profile(payload: dict = Depends(require_role("viewer"))):
    return _serialize_profile(_viewer_or_404(payload))


@router.put("/profile")
def update_profile(body: ViewerProfileUpdateRequest, payload: dict = Depends(require_role("viewer"))):
    viewer = _viewer_or_404(payload)
    updates = {}
    if body.username is not None:
        username = body.username.strip()
        if not 3 <= len(username) <= 30:
            raise HTTPException(status_code=422, detail="Username must be between 3 and 30 characters")
        other = viewers_collection.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}, "_id": {"$ne": viewer["_id"]}})
        if other:
            raise HTTPException(status_code=409, detail="Username already in use")
        updates["username"] = username
    if body.email is not None:
        email = str(body.email).strip().lower()
        duplicate_viewer = viewers_collection.find_one({"email": email, "_id": {"$ne": viewer["_id"]}})
        from database import directors_collection, admin_collection
        duplicate_other_role = (
            directors_collection.find_one({"email": email})
            or admin_collection.find_one({"email": email})
        )
        if duplicate_viewer or duplicate_other_role:
            raise HTTPException(status_code=409, detail="Email already registered")
        updates["email"] = email
    if body.bio is not None:
        updates["bio"] = body.bio.strip()
    if body.genrePreferences is not None:
        updates["genrePreferences"] = body.genrePreferences
    if body.maturitySetting is not None:
        if body.maturitySetting not in {"all", "mature"}:
            raise HTTPException(status_code=422, detail="maturitySetting must be 'all' or 'mature'")
        updates["maturitySetting"] = body.maturitySetting

    updates["updatedAt"] = datetime.utcnow()
    viewers_collection.update_one({"_id": viewer["_id"]}, {"$set": updates})
    return _serialize_profile(viewers_collection.find_one({"_id": viewer["_id"]}))


@router.put("/profile/bio")
def update_viewer_bio(body: BioUpdateRequest, payload: dict = Depends(require_role("viewer"))):
    viewer = _viewer_or_404(payload)
    viewers_collection.update_one({"_id": viewer["_id"]}, {"$set": {"bio": body.bio.strip(), "updatedAt": datetime.utcnow()}})
    return {"message": "Bio updated", "bio": body.bio.strip()}


@router.post("/profile/avatar")
def update_viewer_avatar(
    avatar: UploadFile = File(...),
    payload: dict = Depends(require_role("viewer")),
):
    viewer = _viewer_or_404(payload)
    if not avatar.content_type or not avatar.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Avatar must be an image")
    try:
        url = upload_avatar(avatar, str(viewer["_id"]))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Avatar upload failed: {exc}")
    viewers_collection.update_one({"_id": viewer["_id"]}, {"$set": {"avatarUrl": url, "updatedAt": datetime.utcnow()}})
    return {"message": "Avatar updated", "avatarUrl": url}
