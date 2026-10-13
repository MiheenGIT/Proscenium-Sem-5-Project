"""One-time data repair for the analytics fixes. Dry run by default.

    python -m utils.backfill_analytics_data            # report only
    python -m utils.backfill_analytics_data --apply    # write changes

1. video_reactions: old documents have no timestamp, so date-ranged analytics counted them as 0.
   createdAt/updatedAt are set from the ObjectId creation time.
2. analytics_events: sets expireAt (api_request: 30 days, others: 400 days after createdAt) so the TTL index can
   delete old events. Events without it never expire.
3. video_views: removes duplicate (videoId, viewerId) records (keeps the earliest), recomputes
   film.uniqueViews, then creates the unique index the heartbeat endpoint relies on.
"""
import sys

from database import analytics_events_collection, film_collection, video_reactions_collection, video_views_collection


def backfill_reactions(apply):
    missing = {"createdAt": {"$exists": False}}
    count = 0
    for doc in video_reactions_collection.find(missing, {"_id": 1}):
        count += 1
        if apply:
            stamp = doc["_id"].generation_time.replace(tzinfo=None)
            video_reactions_collection.update_one(
                {"_id": doc["_id"]}, {"$set": {"createdAt": stamp, "updatedAt": stamp}}
            )
    print(f"reactions without timestamps: {count}{' (fixed)' if apply else ''}")


def dedupe_views(apply):
    groups = video_views_collection.aggregate([
        {"$sort": {"firstWatchedAt": 1, "_id": 1}},
        {"$group": {"_id": {"v": "$videoId", "u": "$viewerId"}, "ids": {"$push": "$_id"}, "n": {"$sum": 1}}},
        {"$match": {"n": {"$gt": 1}}},
    ])
    extra_ids = []
    for group in groups:
        extra_ids.extend(group["ids"][1:])
    print(f"duplicate video_views records: {len(extra_ids)}{' (removed)' if apply else ''}")
    if not apply:
        return
    if extra_ids:
        video_views_collection.delete_many({"_id": {"$in": extra_ids}})
    for row in video_views_collection.aggregate([{"$group": {"_id": "$videoId", "n": {"$sum": 1}}}]):
        film_collection.update_one({"_id": row["_id"]}, {"$set": {"uniqueViews": row["n"]}})
    video_views_collection.create_index([("videoId", 1), ("viewerId", 1)], unique=True)
    print("unique index on video_views (videoId, viewerId) is in place")


def backfill_event_expiry(apply):
    plans = [
      ({"eventType": "api_request", "expireAt": {"$exists": False}}, 36500),
({"eventType": {"$ne": "api_request"}, "expireAt": {"$exists": False}}, 36500),
    ]
    for query, days in plans:
        count = analytics_events_collection.count_documents(query)
        label = "api_request" if query["eventType"] == "api_request" else "other events"
        print(f"{label} without expireAt: {count}{' (fixed)' if apply else ''}")
        if apply and count:
            analytics_events_collection.update_many(
                query, [{"$set": {"expireAt": {"$add": ["$createdAt", days * 86400000]}}}]
            )
    if apply:
        analytics_events_collection.create_index([("expireAt", 1)], expireAfterSeconds=0)


if __name__ == "__main__":
    apply_changes = "--apply" in sys.argv
    if not apply_changes:
        print("DRY RUN - pass --apply to write changes\n")
    backfill_reactions(apply_changes)
    dedupe_views(apply_changes)
    backfill_event_expiry(apply_changes)
