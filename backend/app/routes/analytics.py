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
    account_deletions_collection,
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


@router.get("/admin/account-deletions")
def account_deletion_insights(
    days: int = Query(365, ge=7, le=3650),
    payload: dict = Depends(require_role("admin")),
):
    since = datetime.utcnow() - timedelta(days=days)
    rows = list(account_deletions_collection.find(
        {"createdAt": {"$gte": since}},
        {"role": 1, "reason": 1, "daysMember": 1, "createdAt": 1},
    ))
    reasons = {}
    roles = {}
    monthly = {}
    stay_total = 0
    stay_count = 0
    for row in rows:
        reason = row.get("reason") or "other"
        reasons[reason] = reasons.get(reason, 0) + 1
        role = row.get("role") or "unknown"
        roles[role] = roles.get(role, 0) + 1
        days_member = row.get("daysMember")
        if isinstance(days_member, (int, float)):
            stay_total += days_member
            stay_count += 1
        created = row.get("createdAt")
        if isinstance(created, datetime):
            month = created.strftime("%Y-%m")
            monthly[month] = monthly.get(month, 0) + 1
    return {
        "total": len(rows),
        "byReason": [
            {"reason": reason, "count": count}
            for reason, count in sorted(reasons.items(), key=lambda item: (-item[1], item[0]))
        ],
        "byRole": [{"role": role, "count": count} for role, count in sorted(roles.items())],
        "averageDaysMember": round(stay_total / stay_count, 1) if stay_count else None,
        "monthly": [{"month": month, "count": count} for month, count in sorted(monthly.items())],
    }


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


def _takeoff_day(video_id, days):
    """Find the first day with at least three views and twice the prior daily average."""
    try:
        oid = ObjectId(video_id)
    except Exception:
        return None
    rows = list(video_views_collection.aggregate([
        {"$match": _and(
            {"videoId": oid},
            _date_query(days, _VIEW_DATE_FIELDS),
        )},
        {"$addFields": {"_when": _VIEW_DATE_EXPR}},
        {"$match": {"_when": {"$ne": None}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$_when"}}, "n": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]))
    counts = [int(row["n"]) for row in rows]
    dates = [row["_id"] for row in rows]
    for index, count in enumerate(counts):
        previous = counts[:index]
        average = sum(previous) / len(previous) if previous else 0
        if count >= 3 and count >= max(2 * average, 3):
            return dates[index]
    return None


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


# =====================================================================
# INSIGHTS (director + admin): best performers, rule-based "why", audience,
# investment hints.  No AI / external API: plain rules only.
#
# PASTE THIS AT THE VERY END of backend/app/routes/analytics.py
#
# New endpoints
#   GET /analytics/director/insights   director token (admin: add &director_id=...)  ?days&sort&order&limit&skip
#   GET /analytics/admin/insights      admin token     ?days&limit
#   GET /analytics/viewer/demographics viewer token
#   PUT /analytics/viewer/demographics viewer token    {"gender": "..."}
# =====================================================================
from collections import Counter
from database import cast_collection

_VIEW_DATE_FIELDS = ["firstWatchedAt", "createdAt", "timestamp", "watchedAt"]
_VIEW_DATE_EXPR = {"$ifNull": ["$firstWatchedAt", {"$ifNull": ["$createdAt", {"$ifNull": ["$timestamp", "$watchedAt"]}]}]}
_VISIBLE_COMMENT = {"$or": [{"moderationStatus": "visible"}, {"moderationStatus": {"$exists": False}}]}
_POS_WORDS = {"good", "great", "amazing", "awesome", "love", "loved", "beautiful", "best", "brilliant",
              "perfect", "masterpiece", "excellent", "superb", "wow", "fantastic", "enjoyed", "wonderful",
              "hot", "mast", "badhiya", "zabardast", "shandar", "kamaal"}
_NEG_WORDS = {"bad", "boring", "worst", "terrible", "awful", "poor", "hate", "hated", "cringe", "dull",
              "confusing", "disappointing", "weak", "waste", "bakwas", "bekar", "faltu"}
_NAME_STOP = {"the", "and", "she", "her", "his", "him", "was", "who", "you", "not", "one", "can", "all", "for",
              "but", "are", "has", "had", "how", "its", "out", "too", "very", "this", "that", "with", "what"}
_THEME_WORDS = {
    "Story & writing": {"story", "plot", "script", "writing", "narrative", "storyline"},
    "Pacing": {"pace", "pacing", "slow", "dragging", "fast", "long"},
    "Acting & cast": {"acting", "acted", "actor", "actress", "performance", "cast"},
    "Audio & dialogue": {"audio", "sound", "dialogue", "voice", "volume", "music", "song", "bgm"},
    "Visuals & editing": {"visual", "visuals", "cinematography", "editing", "camera", "effects"},
    "Emotional impact": {"emotional", "moving", "touching", "funny", "exciting", "engaging"},
}
_SORT_KEYS = {"score": "score", "views": "views", "completion": "completionRate", "likes": "likeRatio",
              "rating": "avgRating", "comments": "comments"}
_GENDER_LABELS = {"female": "Female", "male": "Male", "non_binary": "Non-binary",
                  "prefer_not_to_say": "Prefer not to say", "not_provided": "Not shared"}


def _pct(part, whole):
    return round(part / whole * 100, 1) if whole else None


# ───────────── raw stat queries (each is one grouped query) ─────────────
def _completion_stats(days, film_filter=None):
    """{videoId: [history rows, completed rows]} from watch_history."""
    done = {"$or": [{"$eq": ["$completed", True]}, {"$gte": ["$progress", 95]},
                    {"$and": [{"$lte": ["$progress", 1]}, {"$gte": ["$progress", 0.95]}]}]}
    match = _and(_date_query(days, ["lastWatchedAt", "updatedAt", "createdAt"]), film_filter)
    out = {}
    for row in watch_history_collection.aggregate([
        {"$match": match},
        {"$group": {"_id": "$videoId", "rows": {"$sum": 1}, "done": {"$sum": {"$cond": [done, 1, 0]}}}},
    ]):
        cur = out.setdefault(str(row["_id"]), [0, 0])
        cur[0] += int(row["rows"])
        cur[1] += int(row["done"])
    return out


def _early_drop_stats(days, film_ids):
    """{videoId: [sessions, sessions that never got past 20%]} from playback_progress events."""
    if not film_ids:
        return {}
    out = {}
    for row in analytics_events_collection.aggregate([
        {"$match": {"eventType": "playback_progress", "createdAt": {"$gte": datetime.utcnow() - timedelta(days=days)},
                    "videoId": {"$in": [str(i) for i in film_ids]}}},
        {"$group": {"_id": {"v": "$videoId", "s": "$sessionId"}, "peak": {"$max": "$progressPercent"}}},
        {"$group": {"_id": "$_id.v", "sessions": {"$sum": 1},
                    "early": {"$sum": {"$cond": [{"$lt": ["$peak", 20]}, 1, 0]}}}},
    ]):
        out[str(row["_id"])] = [int(row["sessions"]), int(row["early"])]
    return out


def _reaction_stats(days, film_filter):
    like = {"$or": [{"$in": ["$type", ["like", "liked"]]}, {"$in": ["$reaction", ["like", "liked", 1]]}]}
    dislike = {"$or": [{"$in": ["$type", ["dislike", "disliked"]]}, {"$in": ["$reaction", ["dislike", "disliked", -1]]}]}
    match = _and(film_filter, _date_query(days, ["createdAt", "created_at", "timestamp"]))
    out = {}
    for row in video_reactions_collection.aggregate([
        {"$match": match},
        {"$group": {"_id": "$videoId", "likes": {"$sum": {"$cond": [like, 1, 0]}},
                    "dislikes": {"$sum": {"$cond": [dislike, 1, 0]}}}},
    ]):
        cur = out.setdefault(str(row["_id"]), [0, 0])
        cur[0] += int(row["likes"])
        cur[1] += int(row["dislikes"])
    return out


def _rating_stats(days, film_filter):
    out = {}
    match = _and(film_filter, _date_query(days, ["createdAt", "created_at", "timestamp"]), {"moderationStatus": {"$ne": "removed"}})
    for row in video_reviews_collection.aggregate([
        {"$match": match},
        {"$group": {"_id": "$videoId", "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
    ]):
        out[str(row["_id"])] = [round(float(row["avg"] or 0), 2), int(row["n"])]
    return out


def _window_view_stats(start, end=None, film_filter=None):
    """{videoId: [views in [start, end), date of the first one]}"""
    cond = {"$gte": start}
    if end:
        cond["$lt"] = end
    out = {}
    for row in video_views_collection.aggregate([
        {"$match": film_filter or {}},
        {"$addFields": {"_when": _VIEW_DATE_EXPR}},
        {"$match": {"_when": cond}},
        {"$group": {"_id": "$videoId", "n": {"$sum": 1}, "first": {"$min": "$_when"}}},
    ]):
        out[str(row["_id"])] = [int(row["n"]), row["first"]]
    return out


def _feedback_by_video(days, film_filter):
    """{videoId: {"texts": [...], "comments": n, "reviews": n}} for visible comments and reviews."""
    out = {}
    window = _date_query(days, ["createdAt", "created_at", "timestamp"])
    for collection, kind, extra in [(video_reviews_collection, "reviews", {"moderationStatus": {"$ne": "removed"}}),
                                    (comments_collection, "comments", _VISIBLE_COMMENT)]:
        for item in collection.find(_and(film_filter, window, extra)).limit(2000):
            cur = out.setdefault(str(item.get("videoId")), {"texts": [], "comments": 0, "reviews": 0})
            cur[kind] += 1
            body = item.get("text") or item.get("review") or item.get("comment") or item.get("content") or ""
            if isinstance(body, str) and body.strip():
                cur["texts"].append(body.lower()[:400])
    return out


def _gather_stats(films, days, platform_views, platform_completion):
    """All per-film stats for the given films, in one place (used by director and admin)."""
    film_ids = [f["_id"] for f in films if f.get("_id") is not None]
    mine = _film_ids_query("videoId", films)
    cast = {}
    if film_ids:
        for c in cast_collection.find(mine, {"videoId": 1, "name": 1, "characterName": 1}):
            if c.get("name"):
                aliases = [c["name"]]
                if c.get("characterName"):
                    aliases.append(c["characterName"])
                cast.setdefault(str(c.get("videoId")), []).extend(aliases)
    week_ago = datetime.utcnow() - timedelta(days=7)
    return {
        "views": {str(i): platform_views.get(str(i), 0) for i in film_ids},
        "platformViews": platform_views,
        "completion": platform_completion,
        "early": _early_drop_stats(days, film_ids),
        "reactions": _reaction_stats(days, mine) if film_ids else {},
        "ratings": _rating_stats(days, mine) if film_ids else {},
        "recent": _window_view_stats(week_ago, None, mine) if film_ids else {},
        "feedback": _feedback_by_video(days, mine) if film_ids else {},
        "cast": cast,
    }


def _platform_numbers(days):
    """Platform-wide views per film and completion, used as the yardstick for every comparison."""
    views = _counts_by_video(video_views_collection, _date_query(days, _VIEW_DATE_FIELDS))
    catalog = list(film_collection.find({"moderationStatus": "approved", "visibility": "public"}))
    completion = _completion_stats(days)
    platform = {
        "avgViews": round(sum(views.values()) / len(catalog), 1) if catalog else 0,
        "completionRate": _pct(sum(v[1] for v in completion.values()), sum(v[0] for v in completion.values())),
    }
    return views, catalog, completion, platform


# ───────────── text analysis (keyword rules) ─────────────
def _analyze_feedback(texts, cast_names):
    pos = neg = neu = 0
    themes, themes_pos, themes_neg, cast = Counter(), Counter(), Counter(), Counter()
    for text in texts:
        tokens = set(re.findall(r"[a-z']+", text))
        p, n = len(tokens & _POS_WORDS), len(tokens & _NEG_WORDS)
        label = "pos" if p > n else "neg" if n > p else "neu"
        pos, neg, neu = pos + (label == "pos"), neg + (label == "neg"), neu + (label == "neu")
        for theme, words in _THEME_WORDS.items():
            if tokens & words:
                themes[theme] += 1
                if label == "pos":
                    themes_pos[theme] += 1
                elif label == "neg":
                    themes_neg[theme] += 1
        for name in cast_names:
            low = name.lower().strip()
            first = low.split()[0] if low else ""
            # full name, first name, or a nickname that starts the first name ("leo" -> "leonardo")
            nick = any(len(t) >= 3 and t not in _NAME_STOP and t not in _POS_WORDS and t not in _NEG_WORDS
                       and first.startswith(t) for t in tokens)
            if low and (low in text or (len(first) >= 4 and first in tokens) or nick):
                cast[name] += 1
    return {"pos": pos, "neg": neg, "neu": neu, "themes": themes,
            "themes_pos": themes_pos, "themes_neg": themes_neg, "cast": cast}


def _why(row, platform, good):
    """Plain-English reasons from simple rules. Compares a film with the platform average."""
    out = []
    pv, pc = platform.get("avgViews") or 0, platform.get("completionRate")
    comp, ratio, react = row["completionRate"], row["likeRatio"], row["reactions"]
    fb_total = row["sentiment"]["positive"] + row["sentiment"]["negative"] + row["sentiment"]["neutral"]
    if good:
        if pv and row["views"] >= 1.5 * pv:
            out.append(f"Views are {row['views'] / pv:.1f}x the platform average per film.")
        if comp is not None and pc is not None and comp >= pc + 10:
            out.append(f"{comp:.0f}% of viewers watched to the end (platform average {pc:.0f}%).")
        if ratio is not None and ratio >= 0.8 and react >= 3:
            out.append(f"{ratio * 100:.0f}% of reactions are likes.")
        if row["avgRating"] and row["avgRating"] >= 4 and row["reviews"] >= 2:
            out.append(f"Average review rating is {row['avgRating']:.1f} out of 5.")
        if row["trending"]:
            out.append(row["trending"])
        if row["praisedTheme"]:
            out.append(f"Viewers praise the {row['praisedTheme'].lower()} the most.")
        if row["topCast"]:
            n = row["topCast"][1]
            out.append(f"{row['topCast'][0]} is mentioned in {n} comment{'s' if n != 1 else ''} or reviews.")
        if not out:
            out.append("Ranks above the other films on views, completion and engagement.")
    else:
        if pv and row["views"] <= 0.5 * pv:
            out.append("Views are less than half the platform average per film.")
        if row["earlyDropPercent"] is not None and row["earlyDropPercent"] >= 40:
            out.append(f"{row['earlyDropPercent']:.0f}% of viewers left within the first 20% of the film.")
        if comp is not None and pc is not None and comp <= pc - 10:
            out.append("Nobody watched it to the end." if comp == 0
                       else f"Only {comp:.0f}% watched to the end (platform average {pc:.0f}%).")
        if ratio is not None and ratio < 0.5 and react >= 3:
            out.append("None of the reactions are likes." if ratio == 0
                       else f"Only {ratio * 100:.0f}% of reactions are likes.")
        if fb_total >= 3 and row["sentiment"]["negative"] / fb_total >= 0.3:
            out.append(f"{row['sentiment']['negative']} of {fb_total} reviews and comments are negative.")
        if row["criticisedTheme"]:
            out.append(f"Viewers criticise the {row['criticisedTheme'].lower()} the most.")
        if not row["hasThumbnail"]:
            out.append("No thumbnail is set, which hurts clicks.")
        if fb_total == 0:
            out.append("No reviews or comments yet, so there is little feedback to learn from.")
        if not out:
            out.append("Slower than the best films, but there is not enough data to point at one cause.")
    return out


# ───────────── audience (age bands from date_of_birth, optional gender) ─────────────
def _age_band(dob, now=None):
    now = now or datetime.utcnow()
    if not isinstance(dob, datetime):
        return "Unknown"
    age = int((now - dob).days // 365.25)
    if age < 18:
        return "Under 18"
    if age < 25:
        return "18-24"
    if age < 35:
        return "25-34"
    if age < 45:
        return "35-44"
    return "45+"


def _summarize_audience(rows, viewers, genres_by_film):
    """Pure function. rows = video_views docs, viewers = {viewerId: viewer doc}."""
    now = datetime.utcnow()
    by_gender, by_age, g_genres, a_genres = {}, {}, {}, {}
    for r in rows:
        vid = r.get("viewerId")
        v = viewers.get(vid, {})
        g = v.get("gender") or "not_provided"
        a = _age_band(v.get("date_of_birth"), now)
        by_gender[vid], by_age[vid] = g, a
        for genre in genres_by_film.get(str(r.get("videoId")), []):
            g_genres.setdefault(g, Counter())[genre] += 1
            a_genres.setdefault(a, Counter())[genre] += 1
    n = len(by_gender)
    gender, age = Counter(by_gender.values()), Counter(by_age.values())

    def block(counter, genres, label_map=None):
        return [{"label": (label_map or {}).get(k, k), "key": k, "count": c, "percent": _pct(c, n),
                 "topGenres": [g for g, _ in genres.get(k, Counter()).most_common(3)]}
                for k, c in counter.most_common()]

    notes = []
    known_g = {k: c for k, c in gender.items() if k not in ("not_provided", "prefer_not_to_say")}
    if n and sum(known_g.values()) >= 5:
        label, cnt = max(known_g.items(), key=lambda kv: kv[1])
        top = g_genres.get(label, Counter()).most_common(1)
        notes.append(f"{cnt / sum(known_g.values()) * 100:.0f}% of viewers who shared their gender are "
                     f"{_GENDER_LABELS[label].lower()}" + (f"; their most-watched genre is {top[0][0]}." if top else "."))
    elif n:
        notes.append("Not enough viewers have shared their gender yet, so there is no gender breakdown.")
    known_a = {k: c for k, c in age.items() if k != "Unknown"}
    if known_a:
        label, cnt = max(known_a.items(), key=lambda kv: kv[1])
        top = a_genres.get(label, Counter()).most_common(1)
        notes.append(f"The biggest age group is {label} ({cnt / n * 100:.0f}% of viewers)"
                     + (f"; they watch {top[0][0]} most." if top else "."))
    return {"viewers": n, "gender": block(gender, g_genres, _GENDER_LABELS),
            "ageBands": block(age, a_genres), "notes": notes}


def _audience_profile(film_filter, genres_by_film, days):
    rows = list(video_views_collection.find(
        _and(film_filter, _date_query(days, _VIEW_DATE_FIELDS)), {"videoId": 1, "viewerId": 1}).limit(20000))
    ids = list({r["viewerId"] for r in rows if r.get("viewerId") is not None})
    viewers = {}
    if ids:
        for v in viewers_collection.find({"_id": {"$in": ids}}, {"date_of_birth": 1, "gender": 1}):
            viewers[v["_id"]] = v
    return _summarize_audience(rows, viewers, genres_by_film)


def _genre_list(film):
    genres = film.get("genres") or []
    if isinstance(genres, str):
        genres = [g.strip() for g in genres.split(",") if g.strip()]
    return genres if isinstance(genres, list) else []


# ───────────── film rows, scoring, sorting ─────────────
def _film_rows(live, st, platform, days):
    rows, themes_by_row = [], {}
    for f in live:
        key = str(f["_id"])
        views = st["views"].get(key, 0)
        cr, cd = st["completion"].get(key, [0, 0])
        likes, dislikes = st["reactions"].get(key, [0, 0])
        avg_rating, n_rev = st["ratings"].get(key, [0, 0])
        fb = st["feedback"].get(key, {"texts": [], "comments": 0, "reviews": 0})
        a = _analyze_feedback(fb["texts"], st["cast"].get(key, []))
        sess, early = st["early"].get(key, [0, 0])
        r7, first7 = st["recent"].get(key, [0, None])
        trending = None
        if days >= 14 and r7 >= 3 and views and r7 / views >= 0.5:
            since = first7.strftime("%d %b") if hasattr(first7, "strftime") else "this week"
            trending = f"Trending: {r7} of its {views} views came in the last 7 days (picked up since {since})."
        takeoff = _takeoff_day(key, days)
        if takeoff:
            takeoff_text = datetime.strptime(takeoff, "%Y-%m-%d").strftime("%d %b %Y")
            trending = (f"{trending} Exact takeoff date: {takeoff_text}."
                        if trending else f"Takeoff date: {takeoff_text}.")
        praised, criticised, top_cast = a["themes_pos"].most_common(1), a["themes_neg"].most_common(1), a["cast"].most_common(1)
        feedback_total = a["pos"] + a["neg"] + a["neu"]
        feedback_summary = None
        if feedback_total:
            parts = [f"{a['pos'] / feedback_total * 100:.0f}% of feedback is positive."]
            if praised:
                parts.append(f"Viewers praise the {praised[0][0].lower()} most.")
            if criticised:
                parts.append(f"Some viewers criticise the {criticised[0][0].lower()}.")
            feedback_summary = " ".join(parts)
        rows.append({
            "videoId": key, "title": _video_title(f), "genres": _genre_list(f), "tags": f.get("tags") or [],
            "views": views, "uniqueViewers": views,
            "completionRate": _pct(cd, cr), "likes": likes, "dislikes": dislikes, "reactions": likes + dislikes,
            "likeRatio": round(likes / (likes + dislikes), 2) if likes + dislikes else None,
            "avgRating": avg_rating, "reviews": fb["reviews"] or n_rev, "comments": fb["comments"],
            "sentiment": {"positive": a["pos"], "negative": a["neg"], "neutral": a["neu"]},
            "themes": [{"theme": t, "mentions": n} for t, n in a["themes"].most_common(4)],
            "praisedTheme": praised[0][0] if praised else None,
            "criticisedTheme": criticised[0][0] if criticised else None,
            "castMentions": dict(a["cast"]), "topCast": list(top_cast[0]) if top_cast else None,
            "feedbackSummary": feedback_summary,
            "earlyDropPercent": _pct(early, sess) if sess >= 5 else None,
            "trending": trending, "hasThumbnail": bool(f.get("thumbnailUrl")),
        })
        themes_by_row[key] = a["themes"]
    max_views = max([r["views"] for r in rows] or [0]) or 1
    max_eng = max([r["likes"] + r["reviews"] + r["comments"] for r in rows] or [0]) or 1
    for r in rows:
        v = r["views"] / max_views
        e = (r["likes"] + r["reviews"] + r["comments"]) / max_eng
        r["score"] = round(v * 40 + r["completionRate"] * 0.30 + e * 30, 1) if r["completionRate"] is not None \
            else round(v * 60 + e * 40, 1)
    return rows, themes_by_row


def _sort_rows(rows, sort="score", order="desc"):
    key = _SORT_KEYS.get(sort, "score")
    known = [r for r in rows if r.get(key) is not None]
    unknown = [r for r in rows if r.get(key) is None]
    known.sort(key=lambda r: (r[key], r["views"]), reverse=(order != "asc"))
    return known + unknown


def _similar_films(row, catalog, platform_views, my_director_id=None, n=3):
    mine_g = {g.lower() for g in row["genres"]}
    mine_t = {t.lower() for t in row["tags"]}
    sims = []
    for c in catalog:
        if str(c["_id"]) == row["videoId"]:
            continue
        g = {x.lower() for x in _genre_list(c)}
        t = {x.lower() for x in (c.get("tags") or [])}
        overlap = 2 * len(mine_g & g) + len(mine_t & t)
        if overlap:
            sims.append((overlap, platform_views.get(str(c["_id"]), 0), c))
    sims.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [{"videoId": str(c["_id"]), "title": _video_title(c), "views": v, "genres": _genre_list(c),
             "isYours": my_director_id is not None and str(c.get("directorId")) == str(my_director_id)}
            for _, v, c in sims[:n]]


def _assemble_insights(films, st, platform, catalog, days, sort="score", order="desc", limit=12, skip=0, director_id=None):
    """Pure function (no DB): turns gathered stats into the director response."""
    live = [f for f in films if f.get("moderationStatus") == "approved"]
    base = {"periodDays": days, "platform": platform, "pendingFilms": len(films) - len(live),
            "sort": sort if sort in _SORT_KEYS else "score", "order": "asc" if order == "asc" else "desc",
            "limit": limit, "skip": skip}
    if not live:
        return {**base, "best": [], "others": [], "othersTotal": 0,
                "genreTheme": {"genres": [], "tags": [], "themes": []}, "castBuzz": []}
    rows, themes_by_row = _film_rows(live, st, platform, days)
    rows.sort(key=lambda r: (r["score"], r["views"]), reverse=True)
    cut = max(1, len(rows) // 3)
    best, rest = rows[:cut], rows[cut:]
    for r in best:
        r["reasons"] = _why(r, platform, True)
        r["similar"] = _similar_films(r, catalog, st["platformViews"], director_id)
    rest = _sort_rows(rest, base["sort"], base["order"])
    page = rest[skip:skip + limit]
    for r in page:
        r["reasons"] = _why(r, platform, False)
    genres, tags, themes, cast_buzz = Counter(), Counter(), Counter(), []
    for r in best:
        weight = max(r["views"], 1)
        for g in r["genres"]:
            genres[g] += weight
        for t in r["tags"]:
            tags[t] += weight
        themes.update(themes_by_row[r["videoId"]])
        for name, n in r["castMentions"].items():
            cast_buzz.append({"name": name, "film": r["title"], "mentions": n})
    cast_buzz.sort(key=lambda x: x["mentions"], reverse=True)
    return {
        **base, "best": best, "others": page, "othersTotal": len(rest),
        "genreTheme": {"genres": [{"name": k, "weight": v} for k, v in genres.most_common(6)],
                       "tags": [{"name": k, "weight": v} for k, v in tags.most_common(8)],
                       "themes": [{"theme": k, "mentions": v} for k, v in themes.most_common(5)]},
        "castBuzz": cast_buzz[:8],
        "scoreNote": "Score (0-100) = views 40%, completion 30%, engagement 30%; when completion data is missing: views 60%, engagement 40%.",
        "method": "Rule-based comparison with platform averages and keyword matching; not an AI model.",
    }


# ───────────── director endpoint ─────────────
@router.get("/director/insights")
def director_insights(
    days: int = Query(30, ge=7, le=365),
    sort: str = Query("score"),
    order: str = Query("desc"),
    limit: int = Query(12, ge=1, le=50),
    skip: int = Query(0, ge=0),
    director_id: Optional[str] = Query(None),          # admins only: look at one director's insights
    payload: dict = Depends(require_role("director", "admin")),
):
    if payload.get("role") == "admin":
        if not director_id or not ObjectId.is_valid(director_id):
            raise HTTPException(status_code=400, detail="director_id is required for admins")
        user_id = director_id
    else:
        user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Director identity is missing")
    films = list(film_collection.find(_id_query("directorId", user_id)))
    views, catalog, completion, platform = _platform_numbers(days)
    st = _gather_stats(films, days, views, completion)
    out = _assemble_insights(films, st, platform, catalog, days, sort, order, limit, skip, user_id)
    genres_by_film = {str(f["_id"]): _genre_list(f) for f in films}
    out["audience"] = _audience_profile(_film_ids_query("videoId", films), genres_by_film, days) if films else \
        {"viewers": 0, "gender": [], "ageBands": [], "notes": []}
    return out


# ───────────── admin endpoint: why is it trending, who watches, where to invest ─────────────
def _investment_hints(catalog, platform_views):
    """Pure function: compares each genre's share of views with its share of the catalog."""
    films_by_genre, views_by_genre = Counter(), Counter()
    for f in catalog:
        for g in _genre_list(f):
            films_by_genre[g] += 1
            views_by_genre[g] += platform_views.get(str(f["_id"]), 0)
    total_films, total_views = sum(films_by_genre.values()), sum(views_by_genre.values())
    hints = []
    if not total_films or not total_views:
        return hints
    for g in films_by_genre:
        film_share, view_share = films_by_genre[g] / total_films, views_by_genre[g] / total_views
        if view_share >= 1.5 * film_share and views_by_genre[g] >= 5:
            hints.append({"genre": g, "type": "demand",
                          "text": f"{g} is {view_share * 100:.0f}% of views but only {film_share * 100:.0f}% of films. "
                                  f"Viewers want more of it: promote it or invite more {g} directors."})
        elif film_share >= 1.5 * view_share and films_by_genre[g] >= 3:
            hints.append({"genre": g, "type": "oversupply",
                          "text": f"{g} is {film_share * 100:.0f}% of films but only {view_share * 100:.0f}% of views. "
                                  f"Promote the best of them or review what is not working."})
    return hints


@router.get("/admin/insights")
def admin_insights(
    days: int = Query(30, ge=7, le=365),
    limit: int = Query(5, ge=1, le=15),
    payload: dict = Depends(require_role("admin")),
):
    views, catalog, completion, platform = _platform_numbers(days)
    now = datetime.utcnow()
    start = now - timedelta(days=days)
    previous = _window_view_stats(start - timedelta(days=days), start)
    current = _window_view_stats(start)
    candidates = sorted(catalog, key=lambda f: views.get(str(f["_id"]), 0), reverse=True)[:max(limit * 2, 10)]
    st = _gather_stats(candidates, days, views, completion)
    rows, _ = _film_rows(candidates, st, platform, days)
    rows.sort(key=lambda r: (r["score"], r["views"]), reverse=True)
    top = rows[:limit]
    by_id = {str(f["_id"]): f for f in candidates}
    for r in top:
        key = r["videoId"]
        cur_n, first = current.get(key, [0, None])
        prev_n = previous.get(key, [0, None])[0]
        extra = []
        if prev_n:
            change = round((cur_n - prev_n) / prev_n * 100)
            if abs(change) >= 10:
                extra.append(f"Views are {'up' if change > 0 else 'down'} {abs(change)}% on the previous {days} days.")
            r["growthPercent"] = change
        elif cur_n:
            extra.append(f"New momentum: no views in the previous {days} days, {cur_n} in this period.")
            r["growthPercent"] = None
        if hasattr(first, "strftime"):
            r["firstViewInPeriod"] = first.strftime("%d %b")
        r["reasons"] = extra + _why(r, platform, True)
        film = by_id[key]
        r["audience"] = _audience_profile(_film_ids_query("videoId", [film]), {key: _genre_list(film)}, days)
        for k in ("gender", "ageBands"):                      # keep the payload small for per-film audience
            r["audience"][k] = r["audience"][k][:4]
    genres_by_film = {str(f["_id"]): _genre_list(f) for f in catalog}
    audience = _audience_profile(_film_ids_query("videoId", catalog), genres_by_film, days) if catalog else \
        {"viewers": 0, "gender": [], "ageBands": [], "notes": []}
    cast_buzz = sorted([{"name": n, "film": r["title"], "mentions": c} for r in top for n, c in r["castMentions"].items()],
                       key=lambda x: x["mentions"], reverse=True)[:8]
    return {"periodDays": days, "platform": platform, "trending": top, "audience": audience,
            "investmentHints": _investment_hints(catalog, views), "castBuzz": cast_buzz,
            "method": "Rule-based comparison with platform averages, viewer age (from date of birth) and optional gender; not an AI model."}


# ───────────── viewer: optional gender (used only in aggregate audience stats) ─────────────
class DemographicsPayload(BaseModel):
    gender: Literal["female", "male", "non_binary", "prefer_not_to_say"]


@router.get("/viewer/demographics")
def get_demographics(payload: dict = Depends(require_role("viewer"))):
    viewer = viewers_collection.find_one({"_id": _oid(payload["user_id"])}, {"gender": 1}) or {}
    return {"gender": viewer.get("gender")}


@router.put("/viewer/demographics")
def update_demographics(body: DemographicsPayload, payload: dict = Depends(require_role("viewer"))):
    result = viewers_collection.update_one({"_id": _oid(payload["user_id"])},
                                           {"$set": {"gender": body.gender, "updatedAt": datetime.utcnow()}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Viewer not found")
    return {"gender": body.gender}
