from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime

from utils.security import require_role
from database import film_collection
from models.schemas import RejectVideoRequest, ApproveVideoRequest

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------- helpers ----------

def _get_video_or_404(video_id: str):
    try:
        oid = ObjectId(video_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid video id")

    video = film_collection.find_one({"_id": oid})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return oid, video


def _serialize_video(video: dict) -> dict:
    video["_id"] = str(video["_id"])
    video["directorId"] = str(video["directorId"])
    if video.get("moderatedBy"):
        video["moderatedBy"] = str(video["moderatedBy"])
    for entry in video.get("moderationHistory", []):
        entry["moderatedBy"] = str(entry["moderatedBy"])
    return video


# ---------- list videos pending moderation ----------

@router.get("/videos/pending")
def list_pending_videos(payload: dict = Depends(require_role("admin"))):
    videos = list(
        film_collection.find({"moderationStatus": "pending"}).sort("uploadedAt", 1)
    )
    return {"count": len(videos), "videos": [_serialize_video(v) for v in videos]}


# ---------- list all videos, optionally filtered by status ----------

@router.get("/videos")
def list_all_videos(
    status: str | None = None,
    payload: dict = Depends(require_role("admin"))
):
    valid_statuses = {"pending", "approved", "rejected"}
    query = {}
    if status:
        if status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"status must be one of {sorted(valid_statuses)}"
            )
        query["moderationStatus"] = status

    videos = list(film_collection.find(query).sort("uploadedAt", -1))
    return {"count": len(videos), "videos": [_serialize_video(v) for v in videos]}


# ---------- get single video detail ----------

@router.get("/videos/{video_id}")
def get_video_detail(video_id: str,
                     payload: dict = Depends(require_role("admin"))):

    _, video = _get_video_or_404(video_id)

    return {
        "id": str(video["_id"]),
        "title": video["title"],
        "description": video["description"],
        "hlsManifestUrl": video["hlsManifestUrl"],
        "thumbnailUrl": video.get("thumbnailUrl"),
        "uploadedAt": video["uploadedAt"],
        "moderationStatus": video["moderationStatus"],
        "directorId": str(video["directorId"])
    }
   # return _serialize_video(video)

# ---------- watch a video ----------

@router.get("/videos/{video_id}/watch")
def watch_video(
    video_id: str,
    payload: dict = Depends(require_role("admin"))
):
    _, video = _get_video_or_404(video_id)

    return {
        "title": video["title"],
        "stream_url": video["hlsManifestUrl"]
    }

# ---------- approve a video ----------

@router.post("/videos/{video_id}/approve")
def approve_video(
    video_id: str,
    body: ApproveVideoRequest,
    payload: dict = Depends(require_role("admin"))
):
    oid, video = _get_video_or_404(video_id)

    if video["moderationStatus"] == "approved":
        raise HTTPException(status_code=400, detail="Video is already approved")

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
            "$push": {"moderationHistory": history_entry},
        }
    )
    return {"message": "Video approved", "videoId": video_id, "comment": body.comment}


# ---------- reject a video ----------

@router.post("/videos/{video_id}/reject")
def reject_video(
    video_id: str,
    body: RejectVideoRequest,
    payload: dict = Depends(require_role("admin"))
):
    oid, video = _get_video_or_404(video_id)

    if video["moderationStatus"] == "rejected":
        raise HTTPException(status_code=400, detail="Video is already rejected")

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
            "$push": {"moderationHistory": history_entry},
        }
    )
    return {"message": "Video rejected", "videoId": video_id, "reason": body.reason}


# ---------- reset a video back to pending (undo approve/reject) ----------

@router.post("/videos/{video_id}/reset")
def reset_video_status(video_id: str, payload: dict = Depends(require_role("admin"))):
    oid, video = _get_video_or_404(video_id)

    if video["moderationStatus"] == "pending":
        raise HTTPException(status_code=400, detail="Video is already pending")

    now = datetime.utcnow()
    film_collection.update_one(
        {"_id": oid},
        {"$set": {
            "moderationStatus": "pending",
            "visibility": "private",
            "status": "ready" if video["moderationStatus"] == "approved" else video["status"],
            "updatedAt": now,
        }}
    )
    return {"message": "Video reset to pending", "videoId": video_id}