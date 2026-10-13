from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query

from database import notifications_collection
from utils.security import require_role

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _scope(payload: dict) -> dict:
    """Mongo filter that restricts every query to the caller's own notifications."""
    role = payload["role"]
    try:
        uid = ObjectId(payload["user_id"])
    except (InvalidId, TypeError):
        raise HTTPException(status_code=401, detail="Invalid identity")
    scope = {"recipientRole": role, "recipientId": uid}
    if role == "viewer":  # include legacy rows written before recipientId existed
        return {"$or": [scope, {"viewerId": uid}]}
    return scope


def _serialize(row: dict) -> dict:
    return {
        "id": str(row["_id"]),
        "type": row.get("type", "system"),
        "title": row.get("title", "Proscenium update"),
        "message": row.get("message", ""),
        "videoId": str(row["videoId"]) if row.get("videoId") else None,
        "commentId": str(row["commentId"]) if row.get("commentId") else None,
        "reviewId": str(row["reviewId"]) if row.get("reviewId") else None,
        "link": row.get("link"),
        "read": bool(row.get("read", False)),
        "createdAt": row.get("createdAt"),
    }


AnyRole = require_role("viewer", "director", "admin")


@router.get("")
def list_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    unread_only: bool = False,
    payload: dict = Depends(AnyRole),
):
    base = _scope(payload)
    query = {"$and": [base, {"read": False}]} if unread_only else base
    rows = (
        notifications_collection.find(query)
        .sort("createdAt", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    total = notifications_collection.count_documents(query)
    unread = notifications_collection.count_documents({"$and": [base, {"read": False}]})
    return {
        "unread": unread,
        "total": total,
        "page": page,
        "limit": limit,
        "hasMore": page * limit < total,
        "notifications": [_serialize(r) for r in rows],
    }


@router.get("/unread-count")
def unread_count(payload: dict = Depends(AnyRole)):
    return {
        "unread": notifications_collection.count_documents(
            {"$and": [_scope(payload), {"read": False}]}
        )
    }


@router.post("/read-all")
def mark_all_read(payload: dict = Depends(AnyRole)):
    result = notifications_collection.update_many(
        {"$and": [_scope(payload), {"read": False}]},
        {"$set": {"read": True, "readAt": datetime.utcnow()}},
    )
    return {"message": "Notifications marked as read", "updated": result.modified_count}


@router.patch("/{notification_id}/read")
def mark_read(notification_id: str, payload: dict = Depends(AnyRole)):
    try:
        oid = ObjectId(notification_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid notification id")
    result = notifications_collection.update_one(
        {"$and": [_scope(payload), {"_id": oid}]},
        {"$set": {"read": True, "readAt": datetime.utcnow()}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}
