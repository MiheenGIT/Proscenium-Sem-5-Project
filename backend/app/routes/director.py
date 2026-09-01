from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Request
from utils.security import require_role
from utils.cloudinary_helpers import upload_avatar, _cleanup_cloudinary_assets, delete_cast_photo

import os, shutil
from bson import ObjectId
import subprocess
import glob
import cloudinary
import cloudinary.uploader
from database import film_collection, directors_collection, cast_collection
from models.schemas import BioUpdateRequest
from utils.AIhelpers import ai_upscale_video_espcn, ai_upscale_video_espcn_4x

from database import db
from datetime import datetime
import json 
from typing import Any
from bson.errors import InvalidId
import asyncio

from dotenv import load_dotenv

load_dotenv()



cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


router = APIRouter(prefix='/directors', tags=["directors"])
media_root = "media"

def _get_video_duration_sec(file_path: str) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return float(result.stdout.strip())
    except (ValueError, AttributeError):
        return 0.0


def _get_video_resolution(file_path: str) -> tuple[int, int]:
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=s=x:p=0",
        file_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)

    try:
        width, height = result.stdout.strip().split("x")
        return int(width), int(height)
    except (ValueError, AttributeError):
        return 0, 0


RESOLUTION_LADDER = [
    {"label": "360p",  "width": 640,  "height": 360,  "v_bitrate": "600k",   "bandwidth": 600_000},
    {"label": "480p",  "width": 854,  "height": 480,  "v_bitrate": "1000k",  "bandwidth": 1_000_000},
    {"label": "720p",  "width": 1280, "height": 720,  "v_bitrate": "2500k",  "bandwidth": 2_500_000},
    {"label": "1080p", "width": 1920, "height": 1080, "v_bitrate": "4500k",  "bandwidth": 4_500_000},
    {"label": "1440p", "width": 2560, "height": 1440, "v_bitrate": "8000k",  "bandwidth": 8_000_000},
    {"label": "2160p", "width": 3840, "height": 2160, "v_bitrate": "16000k", "bandwidth": 16_000_000},
]

def _transcode_and_upload_rendition(
    raw_path: str,
    raw_folder: str,
    video_id: str,
    rendition: dict,
    input_path: str
) -> dict:
    """
    Creates one HLS rendition using FFmpeg.

    The caller only requests resolutions that are at or below
    the uploaded video's original resolution.
    """

    label = rendition["label"]
    output_path = os.path.join(raw_folder, f"index_{label}.m3u8")

    # input_path is already decided by the caller.
    # It will be either the original video or the
    # OpenVINO AI-upscaled 1080p video.

    # ---------------------------------------------------------
    # HLS TRANSCODE
    # ---------------------------------------------------------
    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,

        "-vf",
        f"scale={rendition['width']}:{rendition['height']}:flags=lanczos",

        "-c:v", "libx264",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",

        "-c:a", "aac",
        "-b:v", rendition["v_bitrate"],
        "-b:a", "128k",

        "-g", "180",
        "-keyint_min", "180",
        "-sc_threshold", "0",

        "-hls_time", "6",
        "-hls_list_size", "0",

        "-hls_segment_filename",
        os.path.join(
            raw_folder,
            f"seg_{label}_%03d.ts"
        ),

        "-f", "hls",
        output_path
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg HLS generation failed for {label}:\n"
            f"{result.stderr}"
        )

    # ---------------------------------------------------------
    # UPLOAD SEGMENTS
    # ---------------------------------------------------------
    segment_files = sorted(
        glob.glob(
            os.path.join(
                raw_folder,
                f"seg_{label}_*.ts"
            )
        )
    )

    if not segment_files:
        raise RuntimeError(
            f"No HLS segments were generated for {label}"
        )

    segment_urls = []

    for segment_path in segment_files:

        upload_result = cloudinary.uploader.upload(
            segment_path,
            resource_type="video",
            folder=f"proscenium/{video_id}/{label}"
        )

        segment_urls.append(
            upload_result["secure_url"]
        )

    # ---------------------------------------------------------
    # REWRITE PLAYLIST WITH CLOUDINARY URLs
    # ---------------------------------------------------------
    with open(output_path, "r") as f:
        lines = f.readlines()

    i = 0
    new_lines = []

    for line in lines:

        if line.startswith("#"):
            new_lines.append(line)

        elif line.strip() == "":
            continue

        else:
            new_lines.append(
                segment_urls[i] + "\n"
            )
            i += 1

    with open(output_path, "w") as f:
        f.writelines(new_lines)

    # ---------------------------------------------------------
    # UPLOAD PLAYLIST
    # ---------------------------------------------------------
    index_upload = cloudinary.uploader.upload(
        output_path,
        resource_type="raw",
        folder=f"proscenium/{video_id}"
    )

    return {
        "label": label,
        "returncode": result.returncode,
        "segment_urls": segment_urls,
        "index_url": index_upload["secure_url"],
        "bandwidth": rendition["bandwidth"],
        "resolution": (
            f"{rendition['width']}x{rendition['height']}"
        ),
    }

@router.post("/upload-video")
async def upload_vid(
    request: Request,
    title: str = Form(...),
    description: str = Form(...),
    film: UploadFile = File(...),
    genres: str = Form(""),
    tags: str = Form(""),
    language: str = Form(""),
    productionCountry: str = Form(""),
    cast: str = Form("[]"),
    thumbnailUrl: str = Form(""),
    releaseYear: int | None = Form(None),
    useUpscale: str = Form("true"),
    payload: dict = Depends(require_role("director", "admin"))
):
    use_upscale = useUpscale.lower() == "true"
    director = directors_collection.find_one({"_id": ObjectId(payload["user_id"])})
    if not director:
        raise HTTPException(status_code=401, detail="Director not found")

    try:
        cast_list = json.loads(cast)
        if not isinstance(cast_list, list):
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="cast must be a valid JSON array of {clientId, name, characterName}")

    video_id = str(ObjectId())
    video_oid = ObjectId(video_id)

    # dynamic file fields (cast_photo_<clientId>) can't be declared as a
    # regular File(...) param since we don't know the field names ahead of
    # time — pull them straight off the parsed multipart form instead.
    form = await request.form()
    now = datetime.utcnow()
    cast_doc_ids = []

    for member in cast_list:
        # insert first (photo pending) so the photo's Cloudinary folder can be
        # keyed by this doc's own _id — the one stable identifier available
        # both now and later, when a member is edited or removed individually
        cast_doc = {
            "videoId": video_oid,
            "name": member.get("name", ""),
            "characterName": member.get("characterName", ""),
            "photoUrl": None,
            "createdAt": now,
            "updatedAt": now,
        }
        inserted = cast_collection.insert_one(cast_doc)
        cast_id = inserted.inserted_id

        client_id = member.get("clientId")
        photo_file = form.get(f"cast_photo_{client_id}") if client_id else None
        has_photo = bool(photo_file and getattr(photo_file, "filename", ""))
        if has_photo:
            photo_url = upload_avatar(photo_file, f"{video_id}_cast_{cast_id}")
            cast_collection.update_one({"_id": cast_id}, {"$set": {"photoUrl": photo_url}})

        cast_doc_ids.append(cast_id)

    raw_folder= os.path.join(media_root, video_id, "raw")
    os.makedirs(raw_folder, exist_ok=True)

    raw_path= os.path.join(raw_folder, "original.mp4")

    with open(raw_path, "wb") as f:
        shutil.copyfileobj(film.file, f)

    duration_sec = _get_video_duration_sec(raw_path)
    _, source_height = _get_video_resolution(raw_path)
    file_size_bytes = os.path.getsize(raw_path)

    # ---------------------------------------------------------
    # AI UPSCALING
    # ---------------------------------------------------------
    #
    # Videos below 1080p can be AI-upscaled before the HLS
    # ladder is generated.
    #
    # UPSCALE_ENGINE can be:
    #   openvino
    #   espcn
    #
    # If the source is already 1080p or higher, no AI
    # upscaling is performed.
    # ---------------------------------------------------------

    ai_path = os.path.join(
        raw_folder,
        "ai_upscaled.mp4"
    )

    upscale_engine = os.getenv(
        "UPSCALE_ENGINE",
        "espcn"
    ).lower()

    if source_height < 1080 and use_upscale:

        print(
            f"[AI] Source is {source_height}p. "
            f"Using {upscale_engine} upscaling."
        )

        if upscale_engine == "espcn":

            await asyncio.to_thread(
                ai_upscale_video_espcn,
                raw_path,
                ai_path,
                raw_folder
            )

        elif upscale_engine == "espcn_4x":

            ai_upscale_video_espcn_4x(
                raw_path,
                ai_path,
                raw_folder
            )

        else:

            raise RuntimeError(
                f"Unknown UPSCALE_ENGINE: {upscale_engine}. "
                f"Currently only 'espcn' is enabled."
            )

        hls_input = ai_path

    else:

        reason = "source is already 1080p or higher" if source_height >= 1080 else "AI upscaling disabled by uploader"
        print(f"[AI] Skipping AI upscaling — {reason}.")

        hls_input = raw_path

    # ---------------------------------------------------------
    # Generate HLS renditions from the selected source
    #
    # UPSCALE_TOLERANCE allows one rung slightly above what the
    # AI pass actually produced (e.g. AI output at 960p still
    # allows the 1080p rung) via plain lanczos in
    # _transcode_and_upload_rendition. This is a small, honest
    # stretch on top of real AI-recovered detail — not the same
    # as faking a whole extra rung from an untouched source.
    # ---------------------------------------------------------

    _, processing_height = _get_video_resolution(hls_input)

    UPSCALE_TOLERANCE = 1.2

    available_renditions = [
        r for r in RESOLUTION_LADDER
        if r["height"] <= processing_height * UPSCALE_TOLERANCE
    ]

    renditions = [
        _transcode_and_upload_rendition(
            raw_path,
            raw_folder,
            video_id,
            r,
            input_path=hls_input
        )
        for r in available_renditions
    ]
    master_path = os.path.join(raw_folder, "master.m3u8")
    stream_blocks = "\n\n".join(
        f"#EXT-X-STREAM-INF:BANDWIDTH={r['bandwidth']},RESOLUTION={r['resolution']}\n{r['index_url']}"
        for r in renditions
    )
    master_content = f"#EXTM3U\n#EXT-X-VERSION:3\n\n{stream_blocks}\n"

    with open(master_path, "w") as f:
        f.write(master_content)

    master_result = cloudinary.uploader.upload(
        master_path,
        resource_type="raw",
        folder=f"proscenium/{video_id}"
    )

    shutil.rmtree(raw_folder)
    video_doc = {
        # pins the Mongo _id to video_id — previously unset, so insert_one
        # silently minted a *different* _id than the one every other route
        # (reupload/delete/moderation) looks this film up by. Fixing that
        # here since cast_collection linkage needs a stable, correct id too.
        "_id": video_oid,
        "directorId": ObjectId(payload["user_id"]),  # TODO: replace with real logged-in director's _id once auth is wired into this route
        "title": title,
        "slug": title.lower().replace(" ", "-"),
        "description": description,
        "genres": [g.strip() for g in genres.split(",") if g.strip()],
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
        "language": language,
        "subtitles": [],
        "durationSec": duration_sec,
        "cast": cast_doc_ids,
        "thumbnailUrl": thumbnailUrl,
        "hlsManifestUrl": master_result["secure_url"],
        "rawFileUrl": "",  # raw file was deleted locally, leave blank unless you keep a cloud copy
        "resolutions": [r["label"] for r in renditions],
        "fileSizeBytes": file_size_bytes,
        "mimeType": film.content_type or "video/mp4",
        "status": "ready",
        "visibility": "private",
        "ageRestricted": False,
        "contentWarnings": [],
        "moderationStatus": "pending",
        "moderatedBy": None,
        "moderatedAt": None,
        "views": 0,
        "uniqueViews": 0,
        "likes": 0,
        "dislikes": 0,
        "avgRating": 0,
        "reviewCount": 0,
        "commentCount": 0,
        "releaseYear": releaseYear,
        "productionCountry": productionCountry,
        "isFeatured": False,
        "uploadedAt": datetime.utcnow(),
        "publishedAt": None,
        "updatedAt": datetime.utcnow(),
    }

    insert_result = film_collection.insert_one(video_doc)

    return {
            "video_id": video_id,
            "mongo_id": str(insert_result.inserted_id),
            "message": "Transcoding complete",
            "renditions": {
                r["label"]: {
                    "status": r["returncode"],
                    "index_url": r["index_url"],
                    "segment_urls": r["segment_urls"],
                }
                for r in renditions
            },
            "master_url": master_result["secure_url"]
        }

@router.post("/videos/{video_id}/reupload")
async def reupload_video(
    video_id: str,
    film: UploadFile = File(...),
    payload: dict = Depends(require_role("director"))
):
    try:
        oid = ObjectId(video_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid video id")

    video = film_collection.find_one({"_id": oid})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if str(video["directorId"]) != payload["user_id"]:
        raise HTTPException(status_code=403, detail="Not your video")

    raw_folder = os.path.join(media_root, video_id, "raw")
    os.makedirs(raw_folder, exist_ok=True)
    raw_path = os.path.join(raw_folder, "original.mp4")

    with open(raw_path, "wb") as f:
        shutil.copyfileobj(film.file, f)

    duration_sec = _get_video_duration_sec(raw_path)
    _, source_height = _get_video_resolution(raw_path)
    file_size_bytes = os.path.getsize(raw_path)

    # ---------------------------------------------------------
    # AI UPSCALING
    # ---------------------------------------------------------
    #
    # Videos below 1080p can be AI-upscaled before the HLS
    # ladder is generated.
    #
    # UPSCALE_ENGINE can be:
    #   openvino
    #   espcn
    #
    # If the source is already 1080p or higher, no AI
    # upscaling is performed.
    # ---------------------------------------------------------

    ai_path = os.path.join(
        raw_folder,
        "ai_upscaled.mp4"
    )

    upscale_engine = os.getenv(
        "UPSCALE_ENGINE",
        "espcn"
    ).lower()

    if source_height < 1080:

        print(
            f"[AI] Source is {source_height}p. "
            f"Using {upscale_engine} upscaling."
        )

        if upscale_engine == "espcn":

            await asyncio.to_thread(
                ai_upscale_video_espcn,
                raw_path,
                ai_path,
                raw_folder
            )

        elif upscale_engine == "espcn_4x":

            ai_upscale_video_espcn_4x(
                raw_path,
                ai_path,
                raw_folder
            )

        else:

            raise RuntimeError(
                f"Unknown UPSCALE_ENGINE: {upscale_engine}. "
                f"Currently only 'espcn' is enabled."
        )

        hls_input = ai_path

    else:

        reason = "source is already 1080p or higher" if source_height >= 1080 else "AI upscaling disabled by uploader"
        print(f"[AI] Skipping AI upscaling — {reason}.")

        hls_input = raw_path

    # ---------------------------------------------------------
    # Generate HLS renditions from the selected source
    #
    # UPSCALE_TOLERANCE allows one rung slightly above what the
    # AI pass actually produced (e.g. AI output at 960p still
    # allows the 1080p rung) via plain lanczos in
    # _transcode_and_upload_rendition. This is a small, honest
    # stretch on top of real AI-recovered detail — not the same
    # as faking a whole extra rung from an untouched source.
    # ---------------------------------------------------------

    _, processing_height = _get_video_resolution(hls_input)

    UPSCALE_TOLERANCE = 1.2

    available_renditions = [
        r for r in RESOLUTION_LADDER
        if r["height"] <= processing_height * UPSCALE_TOLERANCE
    ]

    renditions = [
        _transcode_and_upload_rendition(
            raw_path,
            raw_folder,
            video_id,
            r,
            input_path=hls_input
        )
        for r in available_renditions
    ]

    master_path = os.path.join(raw_folder, "master.m3u8")
    stream_blocks = "\n\n".join(
        f"#EXT-X-STREAM-INF:BANDWIDTH={r['bandwidth']},RESOLUTION={r['resolution']}\n{r['index_url']}"
        for r in renditions
    )
    master_content = f"#EXTM3U\n#EXT-X-VERSION:3\n\n{stream_blocks}\n"
    with open(master_path, "w") as f:
        f.write(master_content)

    master_result = cloudinary.uploader.upload(
        master_path,
        resource_type="raw",
        folder=f"proscenium/{video_id}"
    )

    shutil.rmtree(raw_folder)

    # ---- update mongo doc ----
    now = datetime.utcnow()
    history_entry = {
        "action": "reuploaded",
        "comment": None,
        "moderatedBy": ObjectId(payload["user_id"]),
        "moderatedAt": now,
    }

    film_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "hlsManifestUrl": master_result["secure_url"],
                "resolutions": [r["label"] for r in renditions],
                "moderationStatus": "pending",
                "moderationComment": None,
                "moderatedBy": None,
                "moderatedAt": None,
                "status": "ready",          # file itself is ready to stream, just unreviewed
                "visibility": "private",    # pull from public view until re-approved
                "publishedAt": None,        # no longer considered "published" until re-approved
                "updatedAt": now,
                "durationSec": duration_sec,
                "fileSizeBytes": file_size_bytes,
                "mimeType": film.content_type or "video/mp4",
            },
            "$push": {"moderationHistory": history_entry},
        }
    )

    return {
        "video_id": video_id,
        "message": "Video reuploaded and resubmitted for review",
        "renditions": {r["label"]: r["returncode"] for r in renditions},
        "hlsManifestUrl": master_result["secure_url"]
    }

@router.get("/videos/{video_id}/moderation-status")
async def get_moderation_status(
    video_id: str,
    payload: dict = Depends(require_role("director", "admin"))
):
    try:
        oid = ObjectId(video_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid video id")

    video = film_collection.find_one({"_id": oid})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if payload["role"] == "director" and str(video["directorId"]) != payload["user_id"]:
        raise HTTPException(status_code=403, detail="Not your video")

    return {
        "videoId": video_id,
        "title": video.get("title"),
        "moderationStatus": video.get("moderationStatus"),
        "comment": video.get("moderationComment"),
        "moderatedAt": video.get("moderatedAt"),
    }


@router.post("/videos/{video_id}/resubmit")
async def resubmit_video(
    video_id: str,
    payload: dict = Depends(require_role("director"))
):
    try:
        oid = ObjectId(video_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid video id")

    video = film_collection.find_one({"_id": oid})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if str(video["directorId"]) != payload["user_id"]:
        raise HTTPException(status_code=403, detail="Not your video")

    if video["moderationStatus"] != "rejected":
        raise HTTPException(
            status_code=400,
            detail=f"Only rejected videos can be resubmitted (current status: {video['moderationStatus']})"
        )

    now = datetime.utcnow()
    history_entry = {
        "action": "resubmitted",
        "comment": None,
        "moderatedBy": ObjectId(payload["user_id"]),
        "moderatedAt": now,
    }

    film_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "moderationStatus": "pending",
                "moderationComment": None,
                "moderatedBy": None,
                "moderatedAt": None,
                "updatedAt": now,
            },
            "$push": {"moderationHistory": history_entry},
        }
    )
    return {"message": "Video resubmitted for review", "videoId": video_id}

@router.get("/latest-video")
async def get_latest_video():
    film = film_collection.find_one(
        {
            "moderationStatus": "approved",
            "visibility": "public"
        },
        sort=[("publishedAt", -1)]
    )

    if not film:
        return {"error": "No approved videos available"}

    return {
        "title": film.get("title"),
        "hlsManifestUrl": film.get("hlsManifestUrl")
    }

@router.put("/profile/bio")
async def update_director_bio(body: BioUpdateRequest, payload: dict = Depends(require_role("director"))):
    directors_collection.update_one(
        {"_id": ObjectId(payload["user_id"])},
        {"$set": {"bio": body.bio, "updatedAt": datetime.utcnow()}}
    )
    return {"message": "Bio updated", "bio": body.bio}

# ---------- list my videos ----------

def _serialize_video_summary(video: dict) -> dict:
    return {
        "id": str(video["_id"]),
        "title": video.get("title"),
        "thumbnailUrl": video.get("thumbnailUrl"),
        "status": video.get("status"),
        "moderationStatus": video.get("moderationStatus"),
        "visibility": video.get("visibility"),
        "views": video.get("views", 0),
        "durationSec": video.get("durationSec", 0),
        "uploadedAt": video.get("uploadedAt"),
        "publishedAt": video.get("publishedAt"),
    }


@router.get("/videos")
async def list_my_videos(
    payload: dict = Depends(require_role("director"))
):
    videos = list(
        film_collection.find({"directorId": ObjectId(payload["user_id"])})
        .sort("uploadedAt", -1)
    )
    return {
        "count": len(videos),
        "videos": [_serialize_video_summary(v) for v in videos]
    }


# ---------- get one of my videos, full detail ----------

@router.get("/videos/{video_id}")
async def get_my_video(
    video_id: str,
    payload: dict = Depends(require_role("director"))
):
    try:
        oid = ObjectId(video_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid video id")

    video = film_collection.find_one({"_id": oid})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if str(video["directorId"]) != payload["user_id"]:
        raise HTTPException(status_code=403, detail="Not your video")

    video["_id"] = str(video["_id"])
    video["id"] = video["_id"]  # alias matching the list endpoint's field name, so frontend code can use either consistently
    video["directorId"] = str(video["directorId"])
    if video.get("moderatedBy"):
        video["moderatedBy"] = str(video["moderatedBy"])
    for entry in video.get("moderationHistory", []):
        if entry.get("moderatedBy"):
            entry["moderatedBy"] = str(entry["moderatedBy"])

    cast_docs = list(cast_collection.find({"videoId": oid}))
    for c in cast_docs:
        c["_id"] = str(c["_id"])
        c["videoId"] = str(c["videoId"])
    video["cast"] = cast_docs

    return video

@router.delete("/videos/{video_id}")
async def delete_my_video(
    video_id: str,
    payload: dict = Depends(require_role("director"))
):
    try:
        oid = ObjectId(video_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid video id")

    video = film_collection.find_one({"_id": oid})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if str(video["directorId"]) != payload["user_id"]:
        raise HTTPException(status_code=403, detail="Not your video")

    _cleanup_cloudinary_assets(video_id)
    cast_collection.delete_many({"videoId": oid})
    film_collection.delete_one({"_id": oid})

    return {"message": "Video deleted", "videoId": video_id}

@router.put("/videos/{video_id}")
async def update_video_metadata(
    video_id: str,
    request: Request,
    title: str | None = Form(None),
    description: str | None = Form(None),
    genres: str | None = Form(None),
    tags: str | None = Form(None),
    language: str | None = Form(None),
    productionCountry: str | None = Form(None),
    thumbnailUrl: str | None = Form(None),
    releaseYear: int | None = Form(None),
    # JSON array of {_id?, clientId?, name, characterName}.
    # _id present  -> updating an existing cast doc (photo optional/unchanged unless a
    #                 matching cast_photo_{clientId} file is attached)
    # _id absent   -> a brand-new cast member for this film
    # any existing cast doc NOT present in this list -> treated as removed
    cast: str | None = Form(None),
    payload: dict = Depends(require_role("director"))
):
    try:
        oid = ObjectId(video_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid video id")

    video = film_collection.find_one({"_id": oid})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if str(video["directorId"]) != payload["user_id"]:
        raise HTTPException(status_code=403, detail="Not your video")

    update_fields: dict[str, Any] = {"updatedAt": datetime.utcnow()}

    if title is not None:
        update_fields["title"] = title
        update_fields["slug"] = title.lower().replace(" ", "-")
    if description is not None:
        update_fields["description"] = description
    if genres is not None:
        update_fields["genres"] = [g.strip() for g in genres.split(",") if g.strip()]
    if tags is not None:
        update_fields["tags"] = [t.strip() for t in tags.split(",") if t.strip()]
    if language is not None:
        update_fields["language"] = language
    if productionCountry is not None:
        update_fields["productionCountry"] = productionCountry
    if thumbnailUrl is not None:
        update_fields["thumbnailUrl"] = thumbnailUrl
    if releaseYear is not None:
        update_fields["releaseYear"] = releaseYear

    if cast is not None:
        try:
            cast_list = json.loads(cast)
            if not isinstance(cast_list, list):
                raise ValueError
        except (json.JSONDecodeError, ValueError):
            raise HTTPException(status_code=400, detail="cast must be a valid JSON array of {_id?, clientId?, name, characterName}")

        form = await request.form()
        now = datetime.utcnow()

        existing_cast_ids = {str(cid) for cid in video.get("cast", [])}
        kept_ids = set()
        resolved_cast_ids = []

        for member in cast_list:
            member_id = member.get("_id")
            client_id = member.get("clientId")
            photo_file = form.get(f"cast_photo_{client_id}") if client_id else None
            has_new_photo = bool(photo_file and getattr(photo_file, "filename", ""))

            if member_id:
                if member_id not in existing_cast_ids:
                    raise HTTPException(status_code=400, detail=f"cast entry {member_id} does not belong to this video")
                kept_ids.add(member_id)
                update = {
                    "name": member.get("name", ""),
                    "characterName": member.get("characterName", ""),
                    "updatedAt": now,
                }
                if has_new_photo:
                    update["photoUrl"] = upload_avatar(photo_file, f"{video_id}_cast_{member_id}")
                cast_collection.update_one({"_id": ObjectId(member_id)}, {"$set": update})
                resolved_cast_ids.append(ObjectId(member_id))
            else:
                doc = {
                    "videoId": oid,
                    "name": member.get("name", ""),
                    "characterName": member.get("characterName", ""),
                    "photoUrl": None,
                    "createdAt": now,
                    "updatedAt": now,
                }
                inserted = cast_collection.insert_one(doc)
                new_id = inserted.inserted_id
                if has_new_photo:
                    photo_url = upload_avatar(photo_file, f"{video_id}_cast_{new_id}")
                    cast_collection.update_one({"_id": new_id}, {"$set": {"photoUrl": photo_url}})
                resolved_cast_ids.append(new_id)

        # anything that existed before but wasn't sent back this time = removed
        removed_ids = existing_cast_ids - kept_ids
        if removed_ids:
            for rid in removed_ids:
                delete_cast_photo(video_id, rid)
            cast_collection.delete_many({"_id": {"$in": [ObjectId(r) for r in removed_ids]}})

        update_fields["cast"] = resolved_cast_ids

    film_collection.update_one({"_id": oid}, {"$set": update_fields})

    return {"message": "Video metadata updated", "videoId": video_id}