from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError
from datetime import datetime

from utils.security import require_role
from database import film_collection, video_views_collection, viewers_collection

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

    try:
        video_views_collection.insert_one({
            "videoId": oid,
            "viewerId": viewer_id,
            "firstWatchedAt": datetime.utcnow()
        })
    except DuplicateKeyError:
        pass  # already watched before by this viewer — not a new unique view

    # views always increments regardless of first-watch or rewatch
    film_collection.update_one(
        {"_id": oid},
        {"$inc": {"views": 1}}
    )

    return {
        "title": video["title"],
        "stream_url": video["hlsManifestUrl"]
    }