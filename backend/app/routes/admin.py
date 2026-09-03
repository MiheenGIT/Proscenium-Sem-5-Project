from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime

from utils.security import require_role
from database import film_collection, comments_collection, notifications_collection, viewers_collection

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

    # pending queue is shown oldest-first (FIFO review order);
    # everything else defaults to newest-first
    sort_dir = 1 if status == "pending" else -1
    videos = list(film_collection.find(query).sort("uploadedAt", sort_dir))
    return {"count": len(videos), "videos": [_serialize_video(v) for v in videos]}


# ---------- get single video detail ----------

@router.get("/videos/{video_id}")
def get_video_detail(video_id: str, payload: dict = Depends(require_role("admin"))):
    _, video = _get_video_or_404(video_id)
    return _serialize_video(video)
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
    for viewer in viewers_collection.find({"newReleaseNotifications": {"$ne": False}}, {"_id": 1}):
        notifications_collection.insert_one({"viewerId": viewer["_id"], "type": "new_release", "title": "New film on Proscenium", "message": f"{video.get('title', 'A new film')} is now available to watch.", "videoId": oid, "read": False, "createdAt": now})
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

# ---------- comment moderation ----------

def _serialize_flagged_comment(c: dict) -> dict:
    return {
        "id": str(c["_id"]),
        "videoId": str(c["videoId"]),
        "viewerId": str(c["viewerId"]),
        "text": c["text"],
        "moderationStatus": c["moderationStatus"],
        "aiFlagCategories": c.get("aiFlagCategories", []),
        "aiCheckFailed": c.get("aiCheckFailed", False),
        "createdAt": c["createdAt"],
    }


@router.get("/comments/flagged")
def list_flagged_comments(payload: dict = Depends(require_role("admin"))):
    comments = list(
        comments_collection.find({"moderationStatus": "auto_hidden"}).sort("createdAt", 1)
    )
    return {"count": len(comments), "comments": [_serialize_flagged_comment(c) for c in comments]}


@router.post("/comments/{comment_id}/restore")
def restore_comment(comment_id: str, payload: dict = Depends(require_role("admin"))):
    try:
        oid = ObjectId(comment_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid comment id")

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
            "$push": {"moderationHistory": {
                "action": "restored_by_admin",
                "moderatedBy": moderator_id,
                "moderatedAt": now,
            }},
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"message": "Comment restored", "commentId": comment_id}


@router.post("/comments/{comment_id}/remove")
def admin_remove_comment(comment_id: str, payload: dict = Depends(require_role("admin"))):
    try:
        oid = ObjectId(comment_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid comment id")

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
            "$push": {"moderationHistory": {
                "action": "removed_by_admin",
                "moderatedBy": moderator_id,
                "moderatedAt": now,
            }},
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"message": "Comment permanently removed", "commentId": comment_id}