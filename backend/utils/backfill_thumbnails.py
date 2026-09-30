"""One-time backfill: generate a thumbnail for every film_collection video
that has no thumbnailUrl, by grabbing a frame from its hosted HLS stream on
Cloudinary and uploading that frame as a new Cloudinary image asset.

No director login needed — this writes directly to Mongo and Cloudinary
using the project's existing service credentials.

Run once from the backend directory with the venv active:

    python utils/backfill_thumbnails.py
"""
import os
import sys
import subprocess
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import cloudinary.uploader

from database import film_collection
from utils.cloudinary_helpers import cloudinary  # ensures cloudinary.config() has run


def _generate_thumbnail_from_stream(stream_url: str, thumbnail_path: str) -> None:
    """Grab one frame from a remote HLS manifest via ffmpeg."""
    cmd = [
        "ffmpeg",
        "-y",
        "-ss", "1",
        "-i", stream_url,
        "-frames:v", "1",
        "-vf", "scale=1280:-2:flags=lanczos",
        "-q:v", "2",
        thumbnail_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    if result.returncode != 0 or not os.path.exists(thumbnail_path):
        raise RuntimeError(f"ffmpeg failed: {result.stderr}")


def _upload_thumbnail(thumbnail_path: str, video_id: str) -> str:
    result = cloudinary.uploader.upload(
        thumbnail_path,
        resource_type="image",
        public_id=f"proscenium/{video_id}/thumbnail",
        overwrite=True,
        invalidate=True,
    )

    secure_url = result.get("secure_url")
    if not secure_url:
        raise RuntimeError("Cloudinary did not return a secure thumbnail URL.")

    return secure_url


def backfill():
    query = {
        "$or": [
            {"thumbnailUrl": {"$exists": False}},
            {"thumbnailUrl": None},
            {"thumbnailUrl": ""},
        ]
    }

    videos = list(film_collection.find(query))
    print(f"Found {len(videos)} videos with no thumbnail.\n")

    succeeded = 0
    failed = []

    for video in videos:
        video_id = str(video["_id"])
        title = video.get("title", "Untitled")
        stream_url = video.get("hlsManifestUrl")

        if not stream_url:
            print(f"[skip] {title} ({video_id}) — no hlsManifestUrl")
            failed.append(video_id)
            continue

        print(f"[processing] {title} ({video_id})")

        try:
            with tempfile.TemporaryDirectory() as tmp_dir:
                thumbnail_path = os.path.join(tmp_dir, "thumbnail.jpg")

                _generate_thumbnail_from_stream(stream_url, thumbnail_path)
                thumbnail_url = _upload_thumbnail(thumbnail_path, video_id)

                film_collection.update_one(
                    {"_id": video["_id"]},
                    {"$set": {"thumbnailUrl": thumbnail_url}},
                )

                print(f"  -> {thumbnail_url}")
                succeeded += 1

        except Exception as exc:
            print(f"  -> FAILED: {exc}")
            failed.append(video_id)

    print(f"\nDone. {succeeded} succeeded, {len(failed)} failed.")
    if failed:
        print("Failed video ids:", failed)


if __name__ == "__main__":
    backfill()