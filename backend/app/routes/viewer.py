from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError
from datetime import datetime
from pydantic import BaseModel, Field
from models.schemas import CommentCreateRequest, HeartbeatRequest, ReactionRequest, BioUpdateRequest
from fastapi import UploadFile, File
from utils.security import require_role
from utils.cloudinary_helpers import upload_avatar
from database import film_collection, video_views_collection, viewers_collection, watch_sessions_collection, comments_collection, video_reactions_collection

from utils.moderation import check_comment_text

router = APIRouter(prefix="/viewer", tags=["viewer"])


# ---------- helpers ----------

def _get_public_video_or_404(video_id: str):
    try:
        oid = ObjectId(video_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid video id")

    video = film_collection.find_one({"_id": oid})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video["moderationStatus"] != "approved" or video["visibility"] != "public":
        raise HTTPException(status_code=404, detail="Video not found")

    return oid, video


def _serialize_summary(video: dict) -> dict:
    return {
        "id": str(video["_id"]),
        "title": video["title"],
        "description": video.get("description"),
        "thumbnailUrl": video.get("thumbnailUrl"),
        "genres": video.get("genres", []),
        "ageRestricted": video.get("ageRestricted", False),
        "avgRating": video.get("avgRating", 0),
        "views": video.get("views", 0),
        "publishedAt": video.get("publishedAt"),
    }


def _maturity_filter(payload: dict) -> dict:
    """Returns a Mongo query fragment that excludes age-restricted
    content unless the viewer's maturitySetting allows it.
    ASSUMPTION: maturitySetting is either "all" (default, safe) or
    "mature" (shows everything). Adjust here if your schema differs."""
    viewer = viewers_collection.find_one({"_id": ObjectId(payload["user_id"])})
    maturity_setting = viewer.get("maturitySetting", "all") if viewer else "all"

    if maturity_setting == "mature":
        return {}
    return {"ageRestricted": {"$ne": True}}

def _get_unique_views(video_id: ObjectId) -> int:
    return video_views_collection.count_documents({"videoId": video_id})

# ---------- browse approved/public videos ----------

@router.get("/videos")
def browse_videos(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    payload: dict = Depends(require_role("viewer"))
):
    query = {"moderationStatus": "approved", "visibility": "public"}
    query.update(_maturity_filter(payload))
    
    skip = (page - 1) * limit
    total = film_collection.count_documents(query)
    videos = list(
        film_collection.find(query)
        .sort("publishedAt", -1)
        .skip(skip)
        .limit(limit)
    )

    return {
        "count": total,
        "page": page,
        "limit": limit,
        "videos": [_serialize_summary(v) for v in videos]
    }


# ---------- search by title ----------

@router.get("/videos/search")
def search_videos(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    payload: dict = Depends(require_role("viewer"))
):
    query = {
        "moderationStatus": "approved",
        "visibility": "public",
        "title": {"$regex": q, "$options": "i"},
    }
    query.update(_maturity_filter(payload))

    skip = (page - 1) * limit
    total = film_collection.count_documents(query)
    videos = list(
        film_collection.find(query)
        .sort("publishedAt", -1)
        .skip(skip)
        .limit(limit)
    )

    return {
        "count": total,
        "page": page,
        "limit": limit,
        "query": q,
        "videos": [_serialize_summary(v) for v in videos]
    }


# ---------- video detail ----------

@router.get("/videos/{video_id}")
def get_video_detail(
    video_id: str,
    payload: dict = Depends(require_role("viewer"))
):
    oid, video = _get_public_video_or_404(video_id)

    viewer = viewers_collection.find_one({"_id": ObjectId(payload["user_id"])})
    maturity_setting = viewer.get("maturitySetting", "all") if viewer else "all"
    if video.get("ageRestricted") and maturity_setting != "mature":
        raise HTTPException(status_code=403, detail="Content restricted by maturity setting")

    return {
        "id": str(video["_id"]),
        "title": video["title"],
        "description": video.get("description"),
        "thumbnailUrl": video.get("thumbnailUrl"),
        "genres": video.get("genres", []),
        "cast": video.get("cast", []),
        "tags": video.get("tags", []),
        "durationSec": video.get("durationSec", 0),
        "releaseYear": video.get("releaseYear"),
        "productionCountry": video.get("productionCountry"),
        "ageRestricted": video.get("ageRestricted", False),
        "contentWarnings": video.get("contentWarnings", []),
        "avgRating": video.get("avgRating", 0),
        "reviewCount": video.get("reviewCount", 0),
        "views": video.get("views", 0),
        "uniqueViews": _get_unique_views(video["_id"]),
        "publishedAt": video.get("publishedAt"),
    }


# ---------- watch (stream URL + view counting) ----------

@router.get("/videos/{video_id}/watch")
def watch_video(
    video_id: str,
    payload: dict = Depends(require_role("viewer"))
):
    oid, video = _get_public_video_or_404(video_id)

    viewer = viewers_collection.find_one({"_id": ObjectId(payload["user_id"])})
    maturity_setting = viewer.get("maturitySetting", "all") if viewer else "all"
    if video.get("ageRestricted") and maturity_setting != "mature":
        raise HTTPException(status_code=403, detail="Content restricted by maturity setting")

    viewer_id = ObjectId(payload["user_id"])

    # starting (or restarting) playback — reset this viewer's heartbeat
    # session so a genuine rewatch can be counted as a new view.
    # this does NOT touch video_views_collection, so uniqueViews still
    # only ever counts once per viewer, ever.
    watch_sessions_collection.update_one(
        {"videoId": oid, "viewerId": viewer_id},
        {"$set": {
            "accumulatedSeconds": 0.0,
            "lastHeartbeatAt": datetime.utcnow(),
            "lastReportedTimeSec": 0.0,
            "counted": False,
        }},
        upsert=True
    )

    return {
        "title": video["title"],
        "stream_url": video["hlsManifestUrl"]
    }

HEARTBEAT_MAX_GAP_SECONDS = 15   # cap wall-clock gap (pause/tab-switch/lag protection)
VIEW_THRESHOLD_FRACTION = 0.75
PLAYBACK_DRIFT_TOLERANCE = 5     # seconds of allowed mismatch between wall-clock gap and reported playback advance



@router.post("/videos/{video_id}/heartbeat")
def watch_heartbeat(
    video_id: str,
    body: HeartbeatRequest,
    payload: dict = Depends(require_role("viewer"))
):
    oid, video = _get_public_video_or_404(video_id)

    duration = video.get("durationSec", 0)
    if not duration or duration <= 0:
        # can't compute a meaningful threshold without a known duration
        return {"counted": False, "reason": "duration unknown"}

    viewer_id = ObjectId(payload["user_id"])
    now = datetime.utcnow()

    session = watch_sessions_collection.find_one({"videoId": oid, "viewerId": viewer_id})

    if session is None:
        # first heartbeat for this viewer+video — start a fresh session
        watch_sessions_collection.insert_one({
            "videoId": oid,
            "viewerId": viewer_id,
            "accumulatedSeconds": 0.0,
            "lastHeartbeatAt": now,
            "lastReportedTimeSec": body.currentTimeSec,
            "counted": False,
        })
        return {"counted": False, "accumulatedSeconds": 0.0}

    if session.get("counted"):
        # already counted as a view — no need to keep accumulating
        return {"counted": True, "accumulatedSeconds": session["accumulatedSeconds"]}

    wall_clock_gap = (now - session["lastHeartbeatAt"]).total_seconds()
    # cap the gap so a paused/idle tab or a manually-delayed request
    # can't inflate accumulated watch time
    wall_clock_gap = max(0, min(wall_clock_gap, HEARTBEAT_MAX_GAP_SECONDS))

    # cross-check: the player's reported playback position should have
    # advanced by roughly the same amount as real wall-clock time.
    # if it hasn't (or jumped suspiciously further), the heartbeat is
    # likely scripted/spoofed rather than coming from real playback —
    # so don't credit any watch time for this tick.
    reported_advance = body.currentTimeSec - session.get("lastReportedTimeSec", body.currentTimeSec)
    drift = abs(reported_advance - wall_clock_gap)

    if reported_advance < 0 or drift > PLAYBACK_DRIFT_TOLERANCE:
        # seek backward, no playback progress, or advance doesn't
        # plausibly match real time passing — credit nothing this tick
        credited_gap = 0
    else:
        credited_gap = wall_clock_gap

    new_accumulated = session["accumulatedSeconds"] + credited_gap
    just_crossed_threshold = (new_accumulated / duration) >= VIEW_THRESHOLD_FRACTION

    watch_sessions_collection.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "accumulatedSeconds": new_accumulated,
            "lastHeartbeatAt": now,
            "lastReportedTimeSec": body.currentTimeSec,
            "counted": just_crossed_threshold,
        }}
    )

    if just_crossed_threshold:
        try:
            video_views_collection.insert_one({
                "videoId": oid,
                "viewerId": viewer_id,
                "firstWatchedAt": now
            })
            # insert succeeded -> genuinely first time this viewer
            # crossed the threshold for this video
            film_collection.update_one(
                {"_id": oid},
                {"$inc": {"views": 1, "uniqueViews": 1}}
            )
        except DuplicateKeyError:
            # already watched before -> counts as a view, not a new unique view
            film_collection.update_one({"_id": oid}, {"$inc": {"views": 1}})

    return {"counted": just_crossed_threshold, "accumulatedSeconds": new_accumulated}


def _serialize_comment(comment: dict) -> dict:
    return {
        "id": str(comment["_id"]),
        "videoId": str(comment["videoId"]),
        "viewerId": str(comment["viewerId"]),
        "text": comment["text"],
        "parentId": str(comment["parentId"]) if comment.get("parentId") else None,
        "replyIds": [str(r) for r in comment.get("replyIds", [])],
        "createdAt": comment["createdAt"],
        "moderationStatus": comment.get("moderationStatus", "visible"),
    }


# ---------- add a top-level comment ----------

@router.post("/videos/{video_id}/comments")
def add_comment(
    video_id: str,
    body: CommentCreateRequest,
    payload: dict = Depends(require_role("viewer"))
):
    oid, video = _get_public_video_or_404(video_id)
    viewer_id = ObjectId(payload["user_id"])
    now = datetime.utcnow()

    ai_result = check_comment_text(body.text)
    moderation_status = "auto_hidden" if ai_result["flagged"] else "visible"

    comment_doc = {
        "videoId": oid,
        "viewerId": viewer_id,
        "text": body.text,
        "parentId": None,
        "replyIds": [],
        "createdAt": now,
        "moderationStatus": moderation_status,
        "aiFlagged": ai_result["flagged"],
        "aiFlagCategories": ai_result["categories"],
        "aiCheckFailed": ai_result["checkFailed"],
        "moderatedBy": None,
        "moderatedAt": None,
        "moderationHistory": [],
    }
    result = comments_collection.insert_one(comment_doc)
    comment_doc["_id"] = result.inserted_id

    film_collection.update_one({"_id": oid}, {"$inc": {"commentCount": 1}})

    if ai_result["flagged"]:
        viewers_collection.update_one({"_id": viewer_id}, {"$inc": {"flagCount": 1}})

    return _serialize_comment(comment_doc)


# ---------- reply to any comment, top-level or nested ----------

@router.post("/videos/{video_id}/comments/{comment_id}/reply")
def reply_to_comment(
    video_id: str,
    comment_id: str,
    body: CommentCreateRequest,
    payload: dict = Depends(require_role("viewer"))
):
    try:
        video_oid = ObjectId(video_id)
        parent_oid = ObjectId(comment_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid id")

    _get_public_video_or_404(video_id)

    parent = comments_collection.find_one({"_id": parent_oid, "videoId": video_oid})
    if not parent:
        raise HTTPException(status_code=404, detail="Comment not found")

    viewer_id = ObjectId(payload["user_id"])
    now = datetime.utcnow()

    ai_result = check_comment_text(body.text)
    moderation_status = "auto_hidden" if ai_result["flagged"] else "visible"

    reply_doc = {
        "videoId": video_oid,
        "viewerId": viewer_id,
        "text": body.text,
        "parentId": parent_oid,
        "replyIds": [],
        "createdAt": now,
        "moderationStatus": moderation_status,
        "aiFlagged": ai_result["flagged"],
        "aiFlagCategories": ai_result["categories"],
        "aiCheckFailed": ai_result["checkFailed"],
        "moderatedBy": None,
        "moderatedAt": None,
        "moderationHistory": [],
    }
    result = comments_collection.insert_one(reply_doc)
    reply_doc["_id"] = result.inserted_id

    # register this reply against its parent's replyIds list
    comments_collection.update_one(
        {"_id": parent_oid},
        {"$push": {"replyIds": reply_doc["_id"]}}
    )

    film_collection.update_one({"_id": video_oid}, {"$inc": {"commentCount": 1}})

    if ai_result["flagged"]:
        viewers_collection.update_one({"_id": viewer_id}, {"$inc": {"flagCount": 1}})

    return _serialize_comment(reply_doc)


# ---------- list top-level comments for a video ----------

@router.get("/videos/{video_id}/comments")
def list_comments(
    video_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    payload: dict = Depends(require_role("viewer"))
):
    oid, video = _get_public_video_or_404(video_id)

    query = {"videoId": oid, "parentId": None, "moderationStatus": {"$ne": "auto_hidden"}}
    skip = (page - 1) * limit
    total = comments_collection.count_documents(query)
    comments = list(
        comments_collection.find(query)
        .sort("createdAt", -1)
        .skip(skip)
        .limit(limit)
    )

    return {
        "count": total,
        "page": page,
        "limit": limit,
        "comments": [_serialize_comment(c) for c in comments]
    }


# ---------- list direct replies to a specific comment ----------

@router.get("/videos/{video_id}/comments/{comment_id}/replies")
def list_replies(
    video_id: str,
    comment_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    payload: dict = Depends(require_role("viewer"))
):
    try:
        video_oid = ObjectId(video_id)
        parent_oid = ObjectId(comment_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid id")

    _get_public_video_or_404(video_id)

    query = {"videoId": video_oid, "parentId": parent_oid, "moderationStatus": {"$ne": "auto_hidden"}}
    skip = (page - 1) * limit
    total = comments_collection.count_documents(query)
    replies = list(
        comments_collection.find(query)
        .sort("createdAt", 1)
        .skip(skip)
        .limit(limit)
    )

    return {
        "count": total,
        "page": page,
        "limit": limit,
        "replies": [_serialize_comment(r) for r in replies]
    }


# ---------- delete a comment (cascades to all descendant replies) ----------

def _collect_descendant_ids(comment_id: ObjectId) -> list:
    """Iteratively walks parentId links to gather every descendant reply id,
    at any depth, without recursion (avoids deep call stacks on long threads)."""
    all_ids = []
    frontier = [comment_id]
    while frontier:
        children = list(
            comments_collection.find({"parentId": {"$in": frontier}}, {"_id": 1})
        )
        child_ids = [c["_id"] for c in children]
        all_ids.extend(child_ids)
        frontier = child_ids
    return all_ids


@router.delete("/videos/{video_id}/comments/{comment_id}")
def delete_comment(
    video_id: str,
    comment_id: str,
    payload: dict = Depends(require_role("viewer"))
):
    try:
        video_oid = ObjectId(video_id)
        comment_oid = ObjectId(comment_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid id")

    comment = comments_collection.find_one({"_id": comment_oid, "videoId": video_oid})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    viewer_id = ObjectId(payload["user_id"])
    if comment["viewerId"] != viewer_id:
        raise HTTPException(status_code=403, detail="Not your comment")

    descendant_ids = _collect_descendant_ids(comment_oid)
    all_ids_to_delete = [comment_oid] + descendant_ids

    comments_collection.delete_many({"_id": {"$in": all_ids_to_delete}})

    # remove this comment's reference from its parent's replyIds, if it had one
    if comment.get("parentId"):
        comments_collection.update_one(
            {"_id": comment["parentId"]},
            {"$pull": {"replyIds": comment_oid}}
        )

    film_collection.update_one(
        {"_id": video_oid},
        {"$inc": {"commentCount": -len(all_ids_to_delete)}}
    )

    return {
        "message": "Comment deleted",
        "commentId": comment_id,
        "removedCount": len(all_ids_to_delete)
    }

@router.put("/profile/bio")
def update_viewer_bio(body: BioUpdateRequest, payload: dict = Depends(require_role("viewer"))):
    viewers_collection.update_one(
        {"_id": ObjectId(payload["user_id"])},
        {"$set": {"bio": body.bio, "updatedAt": datetime.utcnow()}}
    )
    return {"message": "Bio updated", "bio": body.bio}


@router.post("/videos/{video_id}/react")
def react_to_video(
    video_id: str,
    body: ReactionRequest,
    payload: dict = Depends(require_role("viewer"))
):
    oid, video = _get_public_video_or_404(video_id)
    viewer_id = ObjectId(payload["user_id"])

    existing = video_reactions_collection.find_one({"videoId": oid, "viewerId": viewer_id})

    if existing and existing["type"] == body.type:
        # same reaction tapped again -> remove it (toggle off)
        video_reactions_collection.delete_one({"_id": existing["_id"]})
        film_collection.update_one({"_id": oid}, {"$inc": {body.type + "s": -1}})
        return {"message": f"{body.type} removed", "videoId": video_id, "reaction": None}

    if existing:
        # switching from like -> dislike or vice versa
        old_type = existing["type"]
        video_reactions_collection.update_one(
            {"_id": existing["_id"]}, {"$set": {"type": body.type}}
        )
        film_collection.update_one(
            {"_id": oid},
            {"$inc": {old_type + "s": -1, body.type + "s": 1}}
        )
        return {"message": f"changed to {body.type}", "videoId": video_id, "reaction": body.type}

    # first reaction from this viewer
    video_reactions_collection.insert_one({
        "videoId": oid, "viewerId": viewer_id, "type": body.type,
    })
    film_collection.update_one({"_id": oid}, {"$inc": {body.type + "s": 1}})
    return {"message": f"{body.type}d", "videoId": video_id, "reaction": body.type}