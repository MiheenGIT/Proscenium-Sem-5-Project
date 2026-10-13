import os
import re
from datetime import datetime, timedelta
from typing import Literal, Optional

from pydantic import BaseModel, Field

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from utils.rate_limit import SlidingWindowLimiter, client_ip
from database import (
    viewers_collection,
    directors_collection,
    admin_collection,
    film_collection,
    video_views_collection,
    watch_sessions_collection,
    watch_history_collection,
    watchlist_collection,
    comments_collection,
    video_reactions_collection,
    video_reviews_collection,
    analytics_events_collection,
    watch_log_collection,
)
from utils.security import require_role

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _oid(value):
    try:
        return ObjectId(str(value))
    except (TypeError, ValueError):
        return value


def _id_query(field, value):
    """Match both ObjectId and string IDs to support older documents."""
    return {"$or": [{field: _oid(value)}, {field: str(value)}]}


def _and(*queries):
    queries = [q for q in queries if q]
    if not queries:
        return {}
    if len(queries) == 1:
        return queries[0]
    return {"$and": queries}


def _date_query(days, fields):
    since = datetime.utcnow() - timedelta(days=days)
    return {"$or": [{field: {"$gte": since}} for field in fields]}


def _count(collection, query=None):
    return collection.count_documents(query or {})


def _sum(collection, query, fields):
    total = 0.0
    for row in collection.find(query or {}):
        for field in fields:
            value = row.get(field)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                total += value
                break
    return total


def _video_title(video):
    return video.get("title") or video.get("name") or "Untitled video"


def _event_query(days, extra=None, date_fields=None):
    date_fields = date_fields or [
        "createdAt", "created_at", "timestamp", "watchedAt", "updatedAt",
        "firstWatchedAt", "lastHeartbeatAt", "lastWatchedAt", "startedAt",
    ]
    return _and(extra or {}, _date_query(days, date_fields))


def _day_floor(days):
    """Start (00:00 UTC) of the first calendar day in a `days`-day window that ends today."""
    first = datetime.utcnow().date() - timedelta(days=days - 1)
    return datetime.combine(first, datetime.min.time())


def _daily_counts(collection, query, date_field, days):
    """One aggregation instead of one query per day: {'YYYY-MM-DD': count}."""
    rows = collection.aggregate([
        {"$match": _and(query or {}, {date_field: {"$gte": _day_floor(days)}})},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": f"${date_field}"}}, "n": {"$sum": 1}}},
    ])
    return {row["_id"]: int(row["n"]) for row in rows if row.get("_id")}


def _fill_days(days, **series):
    """Zero-filled daily rows: [{'date': 'Oct 12', <label>: n, ...}]."""
    today = datetime.utcnow().date()
    out = []
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        row = {"date": day.strftime("%b %d")}
        for label, counts in series.items():
            row[label] = int(counts.get(day.isoformat(), 0))
        out.append(row)
    return out


def _daily_trend(days, collection, extra=None, date_fields=None, label="views"):
    # The first listed date field is the canonical one for the collection.
    field = (date_fields or ["createdAt"])[0]
    return _fill_days(days, **{label: _daily_counts(collection, extra, field, days)})


# ---- Watch sessions / watch time -------------------------------------------------
# New plays are appended to watch_session_log (one doc per play, keeps accumulating
# after the view is counted). Older data only exists in watch_sessions (latest play per
# viewer+film), so history before the first log entry is read from there. No overlap.

def _watch_cutoff():
    first = watch_log_collection.find_one({}, sort=[("startedAt", 1)], projection={"startedAt": 1})
    return first.get("startedAt") if first else None


def _watch_parts(days, extra=None, since=None):
    since = since or datetime.utcnow() - timedelta(days=days)
    cutoff = _watch_cutoff()
    legacy_range = {"$gte": since}
    if cutoff:
        legacy_range["$lt"] = cutoff
    return [
        (watch_log_collection, _and(extra or {}, {"lastHeartbeatAt": {"$gte": since}})),
        (watch_sessions_collection, _and(extra or {}, {"lastHeartbeatAt": legacy_range})),
    ]


def _watch_sessions(days, extra=None):
    return sum(_count(collection, query) for collection, query in _watch_parts(days, extra))


def _watch_minutes(days, extra=None):
    total = 0.0
    for collection, query in _watch_parts(days, extra):
        for row in collection.aggregate([{"$match": query}, {"$group": {"_id": None, "s": {"$sum": "$accumulatedSeconds"}}}]):
            total += float(row.get("s") or 0)
    return round(total / 60)


def _watch_daily(days, extra=None):
    merged = {}
    for collection, query in _watch_parts(days, extra, since=_day_floor(days)):
        for day, n in _daily_counts(collection, query, "lastHeartbeatAt", days).items():
            merged[day] = merged.get(day, 0) + n
    return merged


def _counts_by_video(collection, match):
    """{str(videoId): count}: one grouped query instead of one count query per film."""
    counts = {}
    for row in collection.aggregate([{"$match": match}, {"$group": {"_id": "$videoId", "n": {"$sum": 1}}}]):
        key = str(row["_id"])
        counts[key] = counts.get(key, 0) + int(row["n"])
    return counts


def _watch_sessions_by_video(days, extra=None):
    counts = {}
    for collection, query in _watch_parts(days, extra):
        for key, n in _counts_by_video(collection, query).items():
            counts[key] = counts.get(key, 0) + n
    return counts


def _watch_seconds_by_video(days, extra=None):
    seconds = {}
    for collection, query in _watch_parts(days, extra):
        for row in collection.aggregate([{"$match": query}, {"$group": {"_id": "$videoId", "s": {"$sum": "$accumulatedSeconds"}}}]):
            key = str(row["_id"])
            seconds[key] = seconds.get(key, 0.0) + float(row.get("s") or 0)
    return seconds


def _viewer_heartbeats(signups):
    """{str(viewerId): [heartbeat times]} for [(viewer_id, created_at, ...)] in a few queries (was two per viewer)."""
    beats = {}
    for start in range(0, len(signups), 1000):
        chunk = signups[start:start + 1000]
        ids = [item[0] for item in chunk]
        query = {
            "viewerId": {"$in": ids + [str(item) for item in ids]},
            "lastHeartbeatAt": {"$gte": min(item[1] for item in chunk), "$lt": max(item[1] for item in chunk) + timedelta(days=7)},
        }
        for collection in (watch_log_collection, watch_sessions_collection):
            for row in collection.find(query, {"viewerId": 1, "lastHeartbeatAt": 1}):
                beats.setdefault(str(row["viewerId"]), []).append(row["lastHeartbeatAt"])
    return beats


def _active_viewer_ids(since=None, before=None):
    window = {}
    if since:
        window["$gte"] = since
    if before:
        window["$lt"] = before
    ids = set()
    for collection in (watch_log_collection, watch_sessions_collection):
        ids.update(str(v) for v in collection.distinct("viewerId", {"lastHeartbeatAt": window}) if v is not None)
    return ids


def _film_ids_query(field, films):
    ids = [film.get("_id") for film in films if film.get("_id") is not None]
    if not ids:
        # An impossible condition prevents empty $in lists from being combined oddly.
        return {field: {"$in": []}}
    return {"$or": [{field: {"$in": ids}}, {field: {"$in": [str(item) for item in ids]}}]}


def _top_videos(days=None):
    query = _date_query(days, ["firstWatchedAt", "createdAt", "timestamp", "watchedAt"]) if days else {}
    pipeline = []
    if query:
        pipeline.append({"$match": query})
    pipeline.extend([
        {"$group": {"_id": "$videoId", "views": {"$sum": 1}}},
        {"$sort": {"views": -1}},
        {"$limit": 6},
    ])
    top = list(video_views_collection.aggregate(pipeline))
    lookup_ids = []
    for item in top:
        if item.get("_id") is not None:
            lookup_ids += [_oid(item["_id"]), str(item["_id"])]
    films = {str(film["_id"]): film for film in film_collection.find({"_id": {"$in": lookup_ids}})} if lookup_ids else {}
    return [{"title": _video_title(films.get(str(item.get("_id"))) or {}), "views": int(item.get("views", 0))} for item in top]


class AnalyticsEventPayload(BaseModel):
    eventType: Literal["page_view", "page_exit", "session_start", "navigation_click", "search", "playback_start", "playback_progress", "playback_complete", "playback_error", "playback_buffer", "registration_success", "login_failure"]
    visitorId: str = Field(min_length=8, max_length=80)
    sessionId: str = Field(min_length=8, max_length=80)
    path: str = Field(default="/", max_length=250)
    source: Optional[str] = Field(default=None, max_length=120)
    utmSource: Optional[str] = Field(default=None, max_length=120)
    utmMedium: Optional[str] = Field(default=None, max_length=120)
    utmCampaign: Optional[str] = Field(default=None, max_length=160)
    label: Optional[str] = Field(default=None, max_length=100)
    query: Optional[str] = Field(default=None, max_length=120)
    resultsCount: Optional[int] = Field(default=None, ge=0, le=100000)
    videoId: Optional[str] = Field(default=None, max_length=80)
    durationMs: Optional[int] = Field(default=None, ge=0, le=3600000)
    progressPercent: Optional[float] = Field(default=None, ge=0, le=100)
    errorCode: Optional[str] = Field(default=None, max_length=80)


# Events expire automatically (expireAt, TTL index). Keep >365 days so the 12-month range stays complete.
EVENT_RETENTION_DAYS = int(os.getenv("ANALYTICS_RETENTION_DAYS", "400"))
_event_limiter = SlidingWindowLimiter()
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,80}$")
_OBJECT_ID_RE = re.compile(r"^[0-9a-fA-F]{24}$")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_LONG_NUMBER_RE = re.compile(r"\d[\d\s().-]{7,}\d")
# (max events, window seconds) per client IP for events that are easy to fake and move key metrics.
_TYPE_LIMITS = {
    "registration_success": (5, 3600),
    "login_failure": (30, 60),
    "playback_start": (30, 60),
    "playback_complete": (15, 60),
}
_event_indexes_ready = False


def _scrub_text(value, max_len):
    """Free text from the browser can contain personal data: drop anything that looks like an email or phone number."""
    if not value:
        return None
    text = " ".join(str(value).split())[:max_len]
    return None if _EMAIL_RE.search(text) or _LONG_NUMBER_RE.search(text) else text


def _ensure_event_indexes():
    global _event_indexes_ready
    if _event_indexes_ready:
        return
    try:
        analytics_events_collection.create_index([("createdAt", -1)])
        analytics_events_collection.create_index([("eventType", 1), ("createdAt", -1)])
        analytics_events_collection.create_index([("visitorId", 1), ("createdAt", -1)])
        analytics_events_collection.create_index([("sessionId", 1), ("createdAt", -1)])
        analytics_events_collection.create_index([("path", 1), ("createdAt", -1)])
        analytics_events_collection.create_index([("videoId", 1), ("eventType", 1), ("createdAt", -1)])
        analytics_events_collection.create_index([("eventType", 1), ("query", 1), ("createdAt", -1)])
        analytics_events_collection.create_index([("eventType", 1), ("statusCode", 1), ("createdAt", -1)])
        analytics_events_collection.create_index([("expireAt", 1)], expireAfterSeconds=0)
        _event_indexes_ready = True
    except Exception:
        # Tracking must not break page navigation when MongoDB is temporarily unavailable.
        return


def _ensure_analytics_indexes():
    """Indexes for the single-field date / viewer lookups used by the watch-time and trend queries."""
    specs = [
        (watch_log_collection, [("lastHeartbeatAt", 1)]),
        (watch_log_collection, [("viewerId", 1), ("lastHeartbeatAt", 1)]),
        (watch_sessions_collection, [("lastHeartbeatAt", 1)]),
        (watch_sessions_collection, [("viewerId", 1), ("lastHeartbeatAt", 1)]),
        (video_views_collection, [("firstWatchedAt", 1)]),
    ]
    for collection, keys in specs:
        try:
            collection.create_index(keys)
        except Exception:
            continue  # an index failure must never stop the app from starting


def ensure_event_indexes():
    _ensure_event_indexes()
    _ensure_analytics_indexes()


@router.post("/events")
def record_analytics_event(event: AnalyticsEventPayload, request: Request):
    """Collect limited, non-sensitive website engagement events (rate-limited, scrubbed, auto-expiring)."""
    ip = client_ip(request)
    type_limit = _TYPE_LIMITS.get(event.eventType)
    if (
        not _event_limiter.allow(f"ip:{ip}", 240, 60)
        or not _event_limiter.allow(f"visitor:{event.visitorId}", 90, 60)
        or (type_limit and not _event_limiter.allow(f"{ip}:{event.eventType}", *type_limit))
    ):
        raise HTTPException(status_code=429, detail="Too many analytics events")

    path = event.path.split("?")[0].split("#")[0]
    path = path if path.startswith("/") else "/"
    if path.startswith(("/admin", "/director")):
        return {"accepted": False}  # staff pages are never tracked
    if not _ID_RE.match(event.visitorId) or not _ID_RE.match(event.sessionId):
        return {"accepted": False}
    if event.eventType.startswith("playback_") and not (event.videoId and _OBJECT_ID_RE.match(event.videoId)):
        return {"accepted": False}

    _ensure_event_indexes()
    now = datetime.utcnow()
    record = {
        "eventType": event.eventType,
        "visitorId": event.visitorId,
        "sessionId": event.sessionId,
        "path": path[:250],
        "source": (event.source or "direct")[:120],
        "utmSource": event.utmSource[:120] if event.utmSource else None,
        "utmMedium": event.utmMedium[:120] if event.utmMedium else None,
        "utmCampaign": event.utmCampaign[:160] if event.utmCampaign else None,
        "label": _scrub_text(event.label, 100),
        "query": _scrub_text(event.query, 120),
        "resultsCount": event.resultsCount,
        "videoId": event.videoId[:80] if event.videoId else None,
        "durationMs": event.durationMs,
        "progressPercent": event.progressPercent,
        "errorCode": event.errorCode[:80] if event.errorCode else None,
        "createdAt": now,
        "expireAt": now + timedelta(days=EVENT_RETENTION_DAYS),
    }
    try:
        analytics_events_collection.insert_one(record)
    except Exception:
        # Fail open: analytics collection outages should not affect the website.
        return {"accepted": False}
    return {"accepted": True}


def _registration_count(collection, since):
    return collection.count_documents({"createdAt": {"$gte": since}})


@router.get("/admin/engagement")
def admin_engagement_analytics(
    days: int = Query(30, ge=7, le=365),
    payload: dict = Depends(require_role("admin")),
):
    since = datetime.utcnow() - timedelta(days=days)
    event_query = {"createdAt": {"$gte": since}}
    page_query = {**event_query, "eventType": "page_view"}
    session_query = {**event_query, "eventType": "session_start"}
    click_query = {**event_query, "eventType": "navigation_click"}

    page_views = analytics_events_collection.count_documents(page_query)
    sessions = analytics_events_collection.count_documents(session_query)
    unique_visitors = len(analytics_events_collection.distinct("visitorId", page_query))
    unique_sessions = len(analytics_events_collection.distinct("sessionId", page_query))
    clicks = analytics_events_collection.count_documents(click_query)

    top_pages = list(analytics_events_collection.aggregate([
        {"$match": page_query},
        {"$group": {"_id": "$path", "views": {"$sum": 1}, "visitors": {"$addToSet": "$visitorId"}}},
        {"$project": {"path": "$_id", "views": 1, "uniqueVisitors": {"$size": "$visitors"}, "_id": 0}},
        {"$sort": {"views": -1}},
        {"$limit": 8},
    ]))

    top_exits = list(analytics_events_collection.aggregate([
        {"$match": {**event_query, "eventType": "page_exit"}},
        {"$group": {"_id": "$path", "exits": {"$sum": 1}, "avgTimeOnPageMs": {"$avg": "$durationMs"}}},
        {"$sort": {"exits": -1}}, {"$limit": 8},
    ]))

    sources = list(analytics_events_collection.aggregate([
        {"$match": page_query},
        {"$project": {"sourceName": {"$ifNull": ["$utmSource", "$source"]}}},
        {"$group": {"_id": "$sourceName", "visits": {"$sum": 1}}},
        {"$sort": {"visits": -1}},
        {"$limit": 8},
    ]))

    daily = list(analytics_events_collection.aggregate([
        {"$match": event_query},
        {"$project": {"day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}}, "eventType": 1}},
        {"$group": {"_id": {"day": "$day", "eventType": "$eventType"}, "count": {"$sum": 1}}},
    ]))
    daily_map = {}
    for item in daily:
        day = item.get("_id", {}).get("day")
        kind = item.get("_id", {}).get("eventType")
        if day:
            daily_map.setdefault(day, {})[kind] = item.get("count", 0)

    trend = []
    today = datetime.utcnow().date()
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        values = daily_map.get(day.isoformat(), {})
        trend.append({
            "date": day.strftime("%b %d"),
            "pageViews": int(values.get("page_view", 0)),
            "sessions": int(values.get("session_start", 0)),
            "clicks": int(values.get("navigation_click", 0)),
        })

    registrations = (
        _registration_count(viewers_collection, since)
        + _registration_count(directors_collection, since)
        + _registration_count(admin_collection, since)
    )
    campaigns = analytics_events_collection.count_documents({**page_query, "utmCampaign": {"$nin": [None, ""]}})
    registration_events = {"$and": [event_query, {"eventType": "registration_success"}]}
    search_events = {"$and": [event_query, {"eventType": "search"}]}
    playback_events = {"$and": [event_query, {"eventType": "playback_start"}]}
    registration_visitors = set(analytics_events_collection.distinct("visitorId", registration_events))
    playback_visitors = set(analytics_events_collection.distinct("visitorId", playback_events))
    search_sessions = set(analytics_events_collection.distinct("sessionId", search_events))
    playback_sessions = set(analytics_events_collection.distinct("sessionId", playback_events))
    registration_first_watch = len(registration_visitors.intersection(playback_visitors))
    search_to_play_sessions = len(search_sessions.intersection(playback_sessions))
    return {
        "role": "admin",
        "periodDays": days,
        "summary": {
            "pageViews": page_views,
            "sessions": sessions,
            "uniqueVisitors": unique_visitors,
            "uniqueSessions": unique_sessions,
            "navigationClicks": clicks,
            "registrations": registrations,
            "trackedRegistrationEvents": len(registration_visitors),
            "visitorToRegistrationPercent": round(len(registration_visitors) / unique_visitors * 100, 1) if unique_visitors else None,
            "registrationToWatchPercent": round(registration_first_watch / len(registration_visitors) * 100, 1) if registration_visitors else None,
            "searchToPlayPercent": round(search_to_play_sessions / len(search_sessions) * 100, 1) if search_sessions else None,
            "searchSessions": len(search_sessions),
            "searchSessionsWithPlayback": search_to_play_sessions,
            "campaignTaggedPageViews": campaigns,
        },
        "trend": trend,
        "topPages": [{**row, "path": row.get("path") or "/"} for row in top_pages],
        "topExits": [{"path": row.get("_id") or "/", "exits": int(row.get("exits", 0)), "avgTimeOnPageMs": round(float(row.get("avgTimeOnPageMs", 0) or 0), 1)} for row in top_exits],
        "trafficSources": [{"label": row.get("_id") or "direct", "value": int(row.get("visits", 0))} for row in sources],
        "trackingStatus": "active" if page_views else "collecting",
    }


@router.get("/admin")
def admin_analytics(
    days: int = Query(30, ge=7, le=365),
    payload: dict = Depends(require_role("admin")),
):
    # Platform-wide totals; activity trends use the selected date range.
    viewers = _count(viewers_collection)
    directors = _count(directors_collection)
    admins = _count(admin_collection)
    videos = _count(film_collection)
    approved = _count(film_collection, {"moderationStatus": "approved", "visibility": "public"})
    pending = _count(film_collection, {"moderationStatus": "pending"})

    view_query = _event_query(days, date_fields=["firstWatchedAt", "createdAt", "timestamp", "watchedAt"])
    watch_minutes = _watch_minutes(days)

    comments = _count(comments_collection, _event_query(days, date_fields=["createdAt", "created_at", "timestamp"]))
    reviews = _count(video_reviews_collection, _event_query(days, date_fields=["createdAt", "created_at", "timestamp"]))
    watchlists = _count(watchlist_collection, _event_query(days, date_fields=["savedAt", "createdAt", "addedAt", "timestamp"]))
    reactions = _count(video_reactions_collection, _event_query(days, date_fields=["createdAt", "created_at", "timestamp"]))

    trend = _fill_days(
        days,
        views=_daily_counts(video_views_collection, {}, "firstWatchedAt", days),
        sessions=_watch_daily(days),
    )

    # New accounts per day (viewers + directors), so Audience growth has a real growth chart.
    registration_trend = _fill_days(
        days,
        viewers=_daily_counts(viewers_collection, {}, "createdAt", days),
        directors=_daily_counts(directors_collection, {}, "createdAt", days),
    )
    for row in registration_trend:
        row["registrations"] = row["viewers"] + row["directors"]

    top_videos = _top_videos(days)
    return {
        "role": "admin",
        "periodDays": days,
        "summary": {
            "viewers": viewers,
            "directors": directors,
            "admins": admins,
            "totalUsers": viewers + directors + admins,
            "videos": videos,
            "approvedVideos": approved,
            "pendingVideos": pending,
            "views": _count(video_views_collection, view_query),
            "sessions": _watch_sessions(days),
            "watchMinutes": watch_minutes,
            "comments": comments,
            "reviews": reviews,
            "watchlists": watchlists,
            "reactions": reactions,
            "registrations": sum(row["registrations"] for row in registration_trend),
        },
        "trend": trend,
        "registrationTrend": registration_trend,
        "topVideos": top_videos,
        "contentStatus": [
            {"label": "Approved", "value": approved},
            {"label": "Pending", "value": pending},
            {"label": "Other", "value": max(0, videos - approved - pending)},
        ],
    }


@router.get("/director")
def director_analytics(
    days: int = Query(30, ge=7, le=365),
    payload: dict = Depends(require_role("director")),
):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Director identity is missing")
    return _director_report(user_id, days)


def _director_report(user_id, days):
    films = list(film_collection.find(_id_query("directorId", user_id)))
    film_filter = _film_ids_query("videoId", films)
    view_filter = _event_query(days, film_filter, ["firstWatchedAt", "createdAt", "timestamp", "watchedAt"])
    reaction_filter = _event_query(days, film_filter, ["createdAt", "created_at", "timestamp"])
    review_filter = _event_query(days, film_filter, ["createdAt", "created_at", "timestamp"])
    comment_filter = _event_query(days, film_filter, ["createdAt", "created_at", "timestamp"])

    rows = []
    if films:
        views_by = _counts_by_video(video_views_collection, view_filter)
        sessions_by = _watch_sessions_by_video(days, film_filter)
        reactions_by = _counts_by_video(video_reactions_collection, reaction_filter)
        reviews_by = _counts_by_video(video_reviews_collection, review_filter)
    for film in films:
        key = str(film.get("_id"))
        rows.append({
            "title": _video_title(film),
            "status": film.get("moderationStatus", film.get("status", "—")),
            "views": views_by.get(key, 0),
            "sessions": sessions_by.get(key, 0),
            "reactions": reactions_by.get(key, 0),
            "reviews": reviews_by.get(key, 0),
        })
    rows.sort(key=lambda item: item["views"], reverse=True)

    minutes = _watch_minutes(days, film_filter)
    film_ids = [film.get("_id") for film in films if film.get("_id") is not None]
    retention_curve = []
    if film_ids:
        retention_pipeline = [
            {"$match": {"eventType": "playback_progress", "createdAt": {"$gte": datetime.utcnow() - timedelta(days=days)}, "videoId": {"$in": [str(fid) for fid in film_ids]}}},
            {"$project": {"bucket": {"$min": [{"$multiply": [{"$floor": {"$divide": ["$progressPercent", 10]}}, 10]}, 90]}, "sessionId": 1}},
            {"$group": {"_id": "$bucket", "sessions": {"$addToSet": "$sessionId"}}},
            {"$project": {"bucket": "$_id", "sessions": {"$size": "$sessions"}, "_id": 0}},
            {"$sort": {"bucket": 1}},
        ]
        by_bucket = {int(row.get("bucket", 0)): int(row.get("sessions", 0)) for row in analytics_events_collection.aggregate(retention_pipeline)}
        retention_curve = [{"bucket": f"{bucket}-{min(bucket + 10, 100)}%", "sessions": by_bucket.get(bucket, 0)} for bucket in range(0, 100, 10)]
    feedback_rows = []
    if films:
        owned_feedback_filter = _and(_film_ids_query("videoId", films), _date_query(days, ["createdAt", "created_at", "timestamp"]))
        for collection, kind in [(video_reviews_collection, "review"), (comments_collection, "comment")]:
            for item in collection.find(owned_feedback_filter).limit(500):
                body = item.get("text") or item.get("review") or item.get("comment") or item.get("content") or ""
                if isinstance(body, str) and body.strip():
                    feedback_rows.append({"kind": kind, "text": body.lower()[:300]})
    theme_keywords = {
        "Story & writing": ["story", "plot", "script", "writing", "narrative"],
        "Pacing": ["pace", "pacing", "slow", "boring", "dragging", "fast"],
        "Acting & cast": ["acting", "actor", "actress", "performance", "cast"],
        "Audio & dialogue": ["audio", "sound", "dialogue", "voice", "volume"],
        "Visuals & editing": ["visual", "cinematography", "editing", "camera", "effects"],
        "Emotional impact": ["emotional", "moving", "touching", "funny", "exciting", "engaging"],
    }
    feedback_themes = []
    for theme, keywords in theme_keywords.items():
        count = sum(1 for item in feedback_rows if any(word in item["text"] for word in keywords))
        if count:
            feedback_themes.append({"theme": theme, "mentions": count})
    feedback_themes.sort(key=lambda item: item["mentions"], reverse=True)
    positive_words = ["great", "excellent", "love", "amazing", "good", "enjoyed", "beautiful", "wonderful", "brilliant"]
    negative_words = ["bad", "poor", "hate", "awful", "terrible", "boring", "weak", "disappointing", "worst"]
    feedback_sentiment = {"positiveKeywordMatches": sum(1 for item in feedback_rows if any(word in item["text"] for word in positive_words)), "negativeKeywordMatches": sum(1 for item in feedback_rows if any(word in item["text"] for word in negative_words)), "analyzedItems": len(feedback_rows), "method": "keyword heuristic; not an AI sentiment model"}
    return {
        "role": "director",
        "periodDays": days,
        "summary": {
            "videos": len(films),
            "views": _count(video_views_collection, view_filter),
            "sessions": _watch_sessions(days, film_filter),
            "watchMinutes": minutes,
            "reactions": _count(video_reactions_collection, reaction_filter),
            "reviews": _count(video_reviews_collection, review_filter),
            "comments": _count(comments_collection, comment_filter),
        },
        "trend": _daily_trend(days, video_views_collection, film_filter, ["firstWatchedAt", "createdAt", "timestamp", "watchedAt"], "views"),
        "retentionCurve": retention_curve,
        "feedbackThemes": feedback_themes,
        "feedbackSentiment": feedback_sentiment,
        "videos": rows,
    }


@router.get("/viewer")
def viewer_analytics(
    days: int = Query(30, ge=7, le=365),
    payload: dict = Depends(require_role("viewer")),
):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Viewer identity is missing")
    return _viewer_report(user_id, days)


def _viewer_report(user_id, days):
    viewer_filter = _id_query("viewerId", user_id)
    # Accept the same date fields the admin report uses, so older history documents are not dropped.
    history_filter = _and(viewer_filter, _date_query(days, ["lastWatchedAt", "updatedAt", "createdAt"]))
    history_fields = {"videoId": 1, "progress": 1, "progressPercent": 1, "completionPercent": 1, "completed": 1}
    history = list(watch_history_collection.find(history_filter, history_fields).sort("lastWatchedAt", -1))

    # Period metrics follow the selected range; all-time totals are returned separately and labelled as such.
    reaction_type = {"$or": [{"type": {"$in": ["like", "liked"]}}, {"reaction": {"$in": ["like", "liked", 1]}}]}
    creation_dates = ["createdAt", "created_at", "timestamp"]
    watchlist_dates = ["savedAt", "createdAt", "addedAt", "timestamp"]
    likes = _count(video_reactions_collection, _and(viewer_filter, reaction_type, _date_query(days, creation_dates)))
    reviews = _count(video_reviews_collection, _event_query(days, viewer_filter, creation_dates))
    comments = _count(comments_collection, _event_query(days, viewer_filter, creation_dates))
    watchlist = _count(watchlist_collection, _event_query(days, viewer_filter, watchlist_dates))
    all_time = {
        "watchlist": _count(watchlist_collection, viewer_filter),
        "likes": _count(video_reactions_collection, _and(viewer_filter, reaction_type)),
        "reviews": _count(video_reviews_collection, viewer_filter),
        "comments": _count(comments_collection, viewer_filter),
    }
    sessions = _watch_sessions(days, viewer_filter)
    minutes = _watch_minutes(days, viewer_filter)

    # Batch load films and directors for the viewer's history to avoid N+1 queries and remove arbitrary limits
    video_ids = [item.get("videoId") for item in history if item.get("videoId")]
    unique_vids = []
    seen_vids = set()
    for vid in video_ids:
        s = str(vid)
        if s not in seen_vids:
            seen_vids.add(s)
            unique_vids.append(vid)

    films_by_id = {}
    if unique_vids:
        query_film_ids = []
        for vid in unique_vids:
            oid = _oid(vid)
            if isinstance(oid, ObjectId):
                query_film_ids.append(oid)
            query_film_ids.append(str(vid))
        for film in film_collection.find({"_id": {"$in": query_film_ids}}):
            films_by_id[str(film["_id"])] = film

    director_ids = [f.get("directorId") for f in films_by_id.values() if f.get("directorId")]
    directors_by_id = {}
    if director_ids:
        query_dir_ids = []
        for did in set(director_ids):
            oid = _oid(did)
            if isinstance(oid, ObjectId):
                query_dir_ids.append(oid)
            query_dir_ids.append(str(did))
        for director in directors_collection.find({"_id": {"$in": query_dir_ids}}):
            directors_by_id[str(director["_id"])] = director

    completed = 0
    genre_counts = {}
    language_counts = {}
    director_counts = {}
    recent = []
    for item in history:
        raw_progress = item.get("progress", item.get("progressPercent", item.get("completionPercent", 0)))
        if not isinstance(raw_progress, (int, float)):
            raw_progress = 0
        # The heartbeat endpoint stores progress as a fraction from 0 to 1.
        progress_percent = raw_progress * 100 if raw_progress <= 1 else raw_progress
        is_completed = bool(item.get("completed") or progress_percent >= 95)
        if is_completed:
            completed += 1

        vid_key = str(item.get("videoId"))
        film = films_by_id.get(vid_key)
        if film:
            genres = film.get("genres", film.get("genre", []))
            if isinstance(genres, str):
                genres = [part.strip() for part in genres.split(",") if part.strip()]
            if isinstance(genres, list):
                for genre in genres:
                    genre_counts[str(genre)] = genre_counts.get(str(genre), 0) + 1
            language = film.get("language") or "Unknown"
            language_counts[language] = language_counts.get(language, 0) + 1
            director_id = film.get("directorId")
            if director_id:
                director = directors_by_id.get(str(director_id))
                if director:
                    director_name = director.get("studioName") or director.get("name") or "Director"
                    director_counts[director_name] = director_counts.get(director_name, 0) + 1
            if len(recent) < 10:
                recent.append({
                    "title": _video_title(film),
                    "progress": max(0, min(100, progress_percent)),
                    "completed": is_completed,
                })

    trend = _fill_days(days, sessions=_watch_daily(days, viewer_filter))
    genres = [{"label": key, "value": value} for key, value in sorted(genre_counts.items(), key=lambda item: item[1], reverse=True)[:6]]
    languages = [{"label": key, "value": value} for key, value in sorted(language_counts.items(), key=lambda item: item[1], reverse=True)[:6]]
    favorite_directors = [{"label": key, "value": value} for key, value in sorted(director_counts.items(), key=lambda item: item[1], reverse=True)[:6]]
    return {
        "role": "viewer",
        "periodDays": days,
        "summary": {
            "videosWatched": len(history),
            "completed": completed,
            "watchlist": watchlist,
            "likes": likes,
            "reviews": reviews,
            "comments": comments,
            "sessions": sessions,
            "watchMinutes": minutes,
        },
        "allTime": all_time,
        "trend": trend,
        "favoriteGenres": genres,
        "favoriteLanguages": languages,
        "favoriteDirectors": favorite_directors,
        "recentVideos": recent[:6],
    }


def _account_name(account):
    return account.get("studioName") or account.get("username") or "Unnamed account"


@router.get("/admin/users")
def admin_user_list(
    role: Literal["viewer", "director"] = "viewer",
    q: str = Query("", max_length=60),
    limit: int = Query(20, ge=1, le=50),
    skip: int = Query(0, ge=0),
    payload: dict = Depends(require_role("admin")),
):
    """Searchable account list for the admin analytics drill-down. Emails are searchable but never returned."""
    collection = viewers_collection if role == "viewer" else directors_collection
    term = re.escape(q.strip())
    fields = ["username", "email"] + (["studioName"] if role == "director" else [])
    query = {"$or": [{field: {"$regex": term, "$options": "i"}} for field in fields]} if term else {}

    total = collection.count_documents(query)
    rows = list(collection.find(query, {"username": 1, "studioName": 1, "createdAt": 1, "isBanned": 1}).sort("createdAt", -1).skip(skip).limit(limit))
    ids = [row["_id"] for row in rows]
    id_variants = ids + [str(item) for item in ids]
    if role == "viewer":
        grouped = watch_history_collection.aggregate([{"$match": {"viewerId": {"$in": id_variants}}}, {"$group": {"_id": "$viewerId", "n": {"$sum": 1}}}])
    else:
        grouped = film_collection.aggregate([{"$match": {"directorId": {"$in": id_variants}}}, {"$group": {"_id": "$directorId", "n": {"$sum": 1}}}])
    activity = {}
    for item in grouped:
        key = str(item["_id"])
        activity[key] = activity.get(key, 0) + int(item["n"])

    return {
        "role": role,
        "total": total,
        "users": [{
            "id": str(row["_id"]),
            "name": _account_name(row),
            "username": row.get("username"),
            "createdAt": row["createdAt"].isoformat() if isinstance(row.get("createdAt"), datetime) else None,
            "isBanned": bool(row.get("isBanned")),
            "activityCount": activity.get(str(row["_id"]), 0),
        } for row in rows],
    }


@router.get("/admin/users/{role}/{user_id}")
def admin_user_analytics(
    role: Literal["viewer", "director"],
    user_id: str,
    days: int = Query(30, ge=7, le=365),
    payload: dict = Depends(require_role("admin")),
):
    """The same report the account holder sees on their own analytics page."""
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")
    collection = viewers_collection if role == "viewer" else directors_collection
    account = collection.find_one({"_id": oid}, {"username": 1, "studioName": 1, "createdAt": 1, "isBanned": 1})
    if not account:
        raise HTTPException(status_code=404, detail=f"{role.capitalize()} not found")
    report = _viewer_report(str(oid), days) if role == "viewer" else _director_report(str(oid), days)
    report["account"] = {
        "id": str(oid),
        "role": role,
        "name": _account_name(account),
        "username": account.get("username"),
        "createdAt": account["createdAt"].isoformat() if isinstance(account.get("createdAt"), datetime) else None,
        "isBanned": bool(account.get("isBanned")),
    }
    return report


@router.get("/insights")
def public_insights(payload: dict = Depends(require_role("viewer"))):
    top = _top_videos(30)[:5]
    return {
        "topVideos": top,
        "totalPublicVideos": _count(film_collection, {"moderationStatus": "approved", "visibility": "public"}),
    }


@router.get("/admin/tags")
def admin_tag_analytics(
    payload: dict = Depends(require_role("admin")),
):
    """Return a live tag catalogue derived from film metadata. Tags are not a separate collection."""
    pipeline = [
        {"$match": {"tags": {"$exists": True, "$ne": []}}},
        {"$project": {"title": {"$ifNull": ["$title", "$name"]}, "tags": 1, "moderationStatus": 1, "visibility": 1}},
        {"$unwind": "$tags"},
        {"$addFields": {"tagLabel": {"$trim": {"input": {"$toString": "$tags"}}}}},
        {"$match": {"tagLabel": {"$ne": ""}}},
        {"$group": {
            "_id": {"$toLower": "$tagLabel"},
            "label": {"$first": "$tagLabel"},
            "filmCount": {"$sum": 1},
            "films": {"$push": {"title": "$title", "status": "$moderationStatus", "visibility": "$visibility"}},
        }},
        {"$sort": {"filmCount": -1, "label": 1}},
    ]
    rows = []
    for item in film_collection.aggregate(pipeline):
        films = item.get("films", [])
        rows.append({
            "tag": item.get("label") or item.get("_id", ""),
            "filmCount": int(item.get("filmCount", 0)),
            "publishedCount": sum(1 for film in films if film.get("status") == "approved" and film.get("visibility") == "public"),
            "films": [{"title": film.get("title") or "Untitled film", "status": film.get("status") or "unknown"} for film in films[:8]],
        })
    return {"totalTags": len(rows), "totalTaggedFilms": sum(row["filmCount"] for row in rows), "tags": rows}


@router.get("/admin/intelligence")
def admin_intelligence(
    days: int = Query(30, ge=7, le=365),
    payload: dict = Depends(require_role("admin")),
):
    """Platform-wide insights calculated only from recorded events and existing records."""
    since = datetime.utcnow() - timedelta(days=days)
    event_match = {"createdAt": {"$gte": since}}
    event_totals = {}
    failed_searches = 0
    for row in analytics_events_collection.aggregate([
        {"$match": {**event_match, "eventType": {"$in": ["playback_start", "playback_complete", "search", "playback_error", "playback_buffer", "registration_success", "page_view"]}}},
        {"$group": {"_id": "$eventType", "n": {"$sum": 1}, "zero": {"$sum": {"$cond": [{"$eq": ["$resultsCount", 0]}, 1, 0]}}}},
    ]):
        event_totals[row["_id"]] = int(row["n"])
        if row["_id"] == "search":
            failed_searches = int(row["zero"])
    starts = event_totals.get("playback_start", 0)
    completions = event_totals.get("playback_complete", 0)
    searches = event_totals.get("search", 0)
    playback_errors = event_totals.get("playback_error", 0)
    buffers = event_totals.get("playback_buffer", 0)
    registrations = event_totals.get("registration_success", 0)
    page_views = event_totals.get("page_view", 0)
    api_health_rows = list(analytics_events_collection.aggregate([
        {"$match": {**event_match, "eventType": "api_request"}},
        {"$group": {"_id": None, "requests": {"$sum": 1}, "errors": {"$sum": {"$cond": [{"$gte": ["$statusCode", 400]}, 1, 0]}}, "avgResponseMs": {"$avg": "$durationMs"}, "maxResponseMs": {"$max": "$durationMs"}}},
    ]))
    api_health = api_health_rows[0] if api_health_rows else {}
    api_requests = int(api_health.get("requests", 0))
    api_errors = int(api_health.get("errors", 0))
    api_error_rate = round(api_errors / api_requests * 100, 2) if api_requests else None
    # Completion rate counts unique (session, film) plays: replays and repeated events do not inflate it,
    # and a completion only counts when the same session also recorded a start for that film.
    play_sessions = completed_play_sessions = 0
    for row in analytics_events_collection.aggregate([
        {"$match": {**event_match, "eventType": {"$in": ["playback_start", "playback_complete"]}, "videoId": {"$ne": None}}},
        {"$group": {"_id": {"s": "$sessionId", "v": "$videoId"}, "types": {"$addToSet": "$eventType"}}},
        {"$match": {"types": "playback_start"}},
        {"$group": {"_id": None, "started": {"$sum": 1}, "completed": {"$sum": {"$cond": [{"$in": ["playback_complete", "$types"]}, 1, 0]}}}},
    ]):
        play_sessions = int(row.get("started", 0))
        completed_play_sessions = int(row.get("completed", 0))
    completion_rate = round(completed_play_sessions / play_sessions * 100, 1) if play_sessions else None

    search_terms = list(analytics_events_collection.aggregate([
        {"$match": {**event_match, "eventType": "search", "query": {"$nin": [None, ""]}}},
        {"$group": {"_id": {"$toLower": "$query"}, "searches": {"$sum": 1}, "zeroResults": {"$sum": {"$cond": [{"$eq": ["$resultsCount", 0]}, 1, 0]}}}},
        {"$sort": {"zeroResults": -1, "searches": -1}}, {"$limit": 10},
    ]))
    demand_gaps = [{"query": row.get("_id", ""), "searches": int(row.get("searches", 0)), "zeroResults": int(row.get("zeroResults", 0))} for row in search_terms]

    # Per-video totals are computed once (one grouped query per metric) and then summed per director / per film.
    views_by_video = _counts_by_video(video_views_collection, _date_query(days, ["firstWatchedAt", "createdAt", "timestamp", "watchedAt"]))
    watch_seconds_by_video = _watch_seconds_by_video(days)
    films_by_director = {}
    for owned_film in film_collection.find({}, {"directorId": 1}):
        films_by_director.setdefault(str(owned_film.get("directorId")), []).append(str(owned_film["_id"]))

    director_rows = []
    for director in directors_collection.find({}, {"password": 0, "passwordHash": 0, "email": 0}):
        owned_ids = films_by_director.get(str(director.get("_id")), [])
        name = director.get("studioName") or director.get("name") or "Director"
        if not owned_ids:
            director_rows.append({"director": name, "films": 0, "views": 0, "watchMinutes": 0, "completionRate": None})
            continue
        director_rows.append({
            "director": name,
            "films": len(owned_ids),
            "views": sum(views_by_video.get(key, 0) for key in owned_ids),
            "watchMinutes": round(sum(watch_seconds_by_video.get(key, 0.0) for key in owned_ids) / 60),
            "completionRate": None,
        })
    director_rows.sort(key=lambda row: (row["views"], row["watchMinutes"]), reverse=True)

    # Film-level performance uses qualified unique-view records and real watch-history progress.
    film_performance = []
    genre_totals = {}
    language_totals = {}
    new_release_windows = {"first7Days": 0, "first30Days": 0, "first90Days": 0}
    now = datetime.utcnow()
    starts_by_video = _counts_by_video(analytics_events_collection, {**event_match, "eventType": "playback_start"})
    likes_by_video = _counts_by_video(video_reactions_collection, _and({"$or": [{"type": {"$in": ["like", "liked"]}}, {"reaction": {"$in": ["like", "liked", 1]}}]}, _date_query(days, ["createdAt", "created_at", "timestamp"])))
    reviews_by_video = _counts_by_video(video_reviews_collection, _date_query(days, ["createdAt", "created_at", "timestamp"]))
    watchlist_by_video = _counts_by_video(watchlist_collection, _date_query(days, ["savedAt", "createdAt", "addedAt", "timestamp"]))
    # Watch history: one pass over the window, tallied per film as [rows, completed, rewatched].
    history_by_video = {}
    for history_row in watch_history_collection.find(_date_query(days, ["lastWatchedAt", "updatedAt", "createdAt"]), {"videoId": 1, "progress": 1, "completed": 1, "timesWatched": 1}):
        tally = history_by_video.setdefault(str(history_row.get("videoId")), [0, 0, 0])
        tally[0] += 1
        progress = history_row.get("progress", 0)
        if isinstance(progress, (int, float)) and progress <= 1:
            progress *= 100
        if history_row.get("completed") or (isinstance(progress, (int, float)) and progress >= 95):
            tally[1] += 1
        if int(history_row.get("timesWatched", 0) or 0) > 1:
            tally[2] += 1

    for film in film_collection.find({"moderationStatus": "approved", "visibility": "public"}):
        key = str(film.get("_id"))
        view_count = views_by_video.get(key, 0)
        history_total, completed_count, rewatch_count = history_by_video.get(key, (0, 0, 0))
        film_completion_rate = round(completed_count / history_total * 100, 1) if history_total else None
        starts_count = starts_by_video.get(key, 0)
        likes_count = likes_by_video.get(key, 0)
        review_count = reviews_by_video.get(key, 0)
        watchlist_count = watchlist_by_video.get(key, 0)
        title = _video_title(film)
        genres = film.get("genres", [])
        if isinstance(genres, str): genres = [part.strip() for part in genres.split(",") if part.strip()]
        film_performance.append({"title": title, "views": view_count, "uniqueViewers": view_count, "starts": starts_count, "completionRatePercent": film_completion_rate, "completedViewers": completed_count, "rewatchViewers": rewatch_count, "likes": likes_count, "reviews": review_count, "watchlisted": watchlist_count, "genres": genres if isinstance(genres, list) else [], "language": film.get("language") or "Unknown", "releaseYear": film.get("releaseYear"), "durationSec": film.get("durationSec")})
        for genre in genres if isinstance(genres, list) else []:
            genre_totals[str(genre)] = genre_totals.get(str(genre), 0) + view_count
        language = film.get("language") or "Unknown"
        language_totals[language] = language_totals.get(language, 0) + view_count
        release_date = film.get("publishedAt") or film.get("createdAt")
        if isinstance(release_date, datetime):
            age_days = (now - release_date).days
            if 0 <= age_days <= 7: new_release_windows["first7Days"] += view_count
            if 0 <= age_days <= 30: new_release_windows["first30Days"] += view_count
            if 0 <= age_days <= 90: new_release_windows["first90Days"] += view_count
    film_performance.sort(key=lambda row: (row["views"], row["likes"], row["reviews"]), reverse=True)
    max_views = max([row["views"] for row in film_performance] or [0])
    max_engagement = max([row["likes"] + row["reviews"] + row["watchlisted"] for row in film_performance] or [0])
    max_rewatch = max([row["rewatchViewers"] for row in film_performance] or [0])
    for row in film_performance:
        # Transparent 0–100 score: views 35%, completion 30%, engagement 20%, rewatch 15%.
        # Completion is required; otherwise a composite score would imply data we do not have.
        if row["completionRatePercent"] is not None:
            views_component = (row["views"] / max_views * 100) if max_views else 0
            engagement_raw = row["likes"] + row["reviews"] + row["watchlisted"]
            engagement_component = (engagement_raw / max_engagement * 100) if max_engagement else 0
            rewatch_component = (row["rewatchViewers"] / max_rewatch * 100) if max_rewatch else 0
            row["performanceScore"] = round(views_component * 0.35 + row["completionRatePercent"] * 0.30 + engagement_component * 0.20 + rewatch_component * 0.15, 1)
            row["scoreWeights"] = {"qualifiedViews": 35, "completion": 30, "engagement": 20, "rewatch": 15}
        else:
            row["performanceScore"] = None
            row["scoreWeights"] = {"qualifiedViews": 35, "completion": 30, "engagement": 20, "rewatch": 15}
    high_start_low_completion = [row for row in film_performance if row["starts"] >= 5 and row["completionRatePercent"] is not None and row["completionRatePercent"] < 40][:10]
    genre_performance = [{"genre": key, "views": value} for key, value in sorted(genre_totals.items(), key=lambda item: item[1], reverse=True)[:10]]
    language_performance = [{"language": key, "views": value} for key, value in sorted(language_totals.items(), key=lambda item: item[1], reverse=True)[:10]]

    # Viewer activity and lightweight signup cohorts use real account/session timestamps.
    current_viewers = _active_viewer_ids(since=since)
    prior_viewers = _active_viewer_ids(before=since)
    active_viewers = len(current_viewers)
    returning_viewers = len(current_viewers.intersection(prior_viewers))
    cohort_map = {}
    eligible_signups = []
    cohort_clock = datetime.utcnow()
    for viewer in viewers_collection.find({"createdAt": {"$gte": since}}, {"createdAt": 1}):
        created = viewer.get("createdAt")
        if not isinstance(created, datetime):
            continue
        cohort_key = created.strftime("%Y-%m")
        cohort = cohort_map.setdefault(cohort_key, {"cohort": cohort_key, "signups": 0, "returnedWithin7Days": 0, "eligibleFor7DayMeasure": 0})
        cohort["signups"] += 1
        if created + timedelta(days=7) <= cohort_clock:
            cohort["eligibleFor7DayMeasure"] += 1
            eligible_signups.append((viewer.get("_id"), created, cohort))
    heartbeats = _viewer_heartbeats(eligible_signups)
    for viewer_id, created, cohort in eligible_signups:
        window_end = created + timedelta(days=7)
        if any(created <= beat < window_end for beat in heartbeats.get(str(viewer_id), [])):
            cohort["returnedWithin7Days"] += 1
    cohort_rows = []
    for cohort in sorted(cohort_map.values(), key=lambda item: item["cohort"]):
        cohort["earlyReturnRatePercent"] = round(cohort["returnedWithin7Days"] / cohort["eligibleFor7DayMeasure"] * 100, 1) if cohort["eligibleFor7DayMeasure"] else None
        cohort_rows.append(cohort)

    # Funnel stages are event counts, not unique people; the dashboard labels them accordingly.
    # Registrations are not a step in this journey (they are shown on the Marketing tab).
    funnel = [
        {"stage": "Page views", "value": page_views},
        {"stage": "Searches", "value": searches},
        {"stage": "Playback starts", "value": starts},
        {"stage": "Playback completions", "value": completions},
    ]
    return {
        "periodDays": days,
        "eventCoverage": {"playbackStartEvents": starts, "playbackCompletionEvents": completions, "searchEvents": searches, "registrationEvents": registrations},
        "summary": {"searches": searches, "zeroResultSearches": failed_searches, "playbackStarts": starts, "playbackCompletions": completions, "playbackSessions": play_sessions, "completedPlaybackSessions": completed_play_sessions, "completionRatePercent": completion_rate, "playbackErrors": playback_errors, "bufferEvents": buffers, "registrationsTracked": registrations, "activeViewers": active_viewers, "returningViewers": returning_viewers, "apiRequests": api_requests, "apiErrors": api_errors, "apiErrorRatePercent": api_error_rate, "apiAverageResponseMs": round(float(api_health.get("avgResponseMs", 0)), 1) if api_requests else None, "apiMaxResponseMs": round(float(api_health.get("maxResponseMs", 0)), 1) if api_requests else None},
        "cohorts": cohort_rows,
        "funnel": funnel,
        "demandGaps": demand_gaps,
        "directorLeaderboard": director_rows[:10],
        "filmPerformance": film_performance[:15],
        "highStartLowCompletion": high_start_low_completion,
        "genrePerformance": genre_performance,
        "languagePerformance": language_performance,
        "newReleaseViews": new_release_windows,
        "dataNotes": ["Funnel values are event counts, not deduplicated people.", "Playback completion rate = unique (session, film) plays that finished, divided by unique plays that started. Per-film completion in the table below uses watch history instead, so the two can differ.", "Marketing spend, revenue and profit are not inferred without verified financial integrations.", "API health telemetry is kept for 30 days by default, so longer date ranges only show the retained window."],
    }