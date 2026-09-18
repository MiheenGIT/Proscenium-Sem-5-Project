"""One-time backfill: compute moderation fields for existing comments and
reviews that predate the always-fresh-on-read pattern.

Run once after switching _refresh_moderation to read stored fields instead
of recomputing on every request:

    python scripts/backfill_moderation.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import comments_collection, video_reviews_collection
from utils.moderation import check_comment_text


def backfill(collection, label):
    updated = 0
    skipped = 0

    for item in collection.find({}):
        result = check_comment_text(item.get("text", ""))

        update = {
            "moderationFlagged": result["flagged"],
            "moderationCategories": result["categories"],
            "moderationMatchedTerms": result["matchedTerms"],
            "moderationLanguages": result["languages"],
            "moderationLanguageCodes": result["languageCodes"],
            "moderationSeverity": result["severity"],
            "moderationCheckFailed": result["checkFailed"],
        }

        current = {key: item.get(key) for key in update}

        if current != update:
            collection.update_one({"_id": item["_id"]}, {"$set": update})
            updated += 1
        else:
            skipped += 1

    print(f"{label}: {updated} updated, {skipped} already correct")


if __name__ == "__main__":
    backfill(comments_collection, "comments")
    backfill(video_reviews_collection, "video_reviews")
    print("Backfill complete.")