from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError
from datetime import datetime
from pydantic import BaseModel, Field

from utils.security import require_role
from database import film_collection, video_views_collection, viewers_collection, watch_sessions_collection

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


class HeartbeatRequest(BaseModel):
    currentTimeSec: float = Field(..., ge=0)


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