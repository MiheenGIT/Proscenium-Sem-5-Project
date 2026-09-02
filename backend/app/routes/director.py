from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Form,
    Depends,
    HTTPException,
    Request,
)

from utils.security import require_role
from utils.cloudinary_helpers import (
    upload_avatar,
    _cleanup_cloudinary_assets,
    delete_cast_photo,
)

import os
import shutil
import subprocess
import glob
import json
import asyncio

from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
from typing import Any

import cloudinary
import cloudinary.uploader

from database import (
    db,
    film_collection,
    directors_collection,
    cast_collection,
)

from models.schemas import BioUpdateRequest

from utils.AIhelpers import (
    ai_upscale_video_espcn,
    ai_upscale_video_espcn_4x,
)

from dotenv import load_dotenv


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()


# ============================================================
# CLOUDINARY
# ============================================================

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/directors",
    tags=["directors"],
)

media_root = "media"


# ============================================================
# THUMBNAIL SETTINGS
# ============================================================

ALLOWED_THUMBNAIL_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024  # 10 MB


# ============================================================
# VIDEO HELPERS
# ============================================================

def _get_video_duration_sec(file_path: str) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        file_path,
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )

    try:
        return float(result.stdout.strip())
    except (ValueError, AttributeError):
        return 0.0


def _get_video_resolution(file_path: str) -> tuple[int, int]:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=s=x:p=0",
        file_path,
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )

    try:
        width, height = result.stdout.strip().split("x")
        return int(width), int(height)
    except (ValueError, AttributeError):
        return 0, 0


# ============================================================
# HLS RESOLUTION LADDER
# ============================================================

RESOLUTION_LADDER = [
    {
        "label": "360p",
        "width": 640,
        "height": 360,
        "v_bitrate": "600k",
        "bandwidth": 600_000,
    },
    {
        "label": "480p",
        "width": 854,
        "height": 480,
        "v_bitrate": "1000k",
        "bandwidth": 1_000_000,
    },
    {
        "label": "720p",
        "width": 1280,
        "height": 720,
        "v_bitrate": "2500k",
        "bandwidth": 2_500_000,
    },
    {
        "label": "1080p",
        "width": 1920,
        "height": 1080,
        "v_bitrate": "4500k",
        "bandwidth": 4_500_000,
    },
    {
        "label": "1440p",
        "width": 2560,
        "height": 1440,
        "v_bitrate": "8000k",
        "bandwidth": 8_000_000,
    },
    {
        "label": "2160p",
        "width": 3840,
        "height": 2160,
        "v_bitrate": "16000k",
        "bandwidth": 16_000_000,
    },
]


# ============================================================
# THUMBNAIL HELPERS
# ============================================================

def _get_thumbnail_extension(content_type: str) -> str:
    """
    Return a safe file extension based on MIME type.
    """

    mapping = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }

    return mapping.get(content_type, ".jpg")


def _validate_thumbnail_file(thumbnail_file: UploadFile) -> None:
    """
    Validate uploaded thumbnail MIME type and size.
    """

    if not thumbnail_file:
        return

    content_type = (
        thumbnail_file.content_type or ""
    ).lower()

    if content_type not in ALLOWED_THUMBNAIL_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Thumbnail must be JPG, JPEG, PNG, or WEBP.",
        )

    # UploadFile normally exposes a file-like object.
    # Seek to the end to determine size, then restore position.
    try:
        current_position = thumbnail_file.file.tell()

        thumbnail_file.file.seek(0, os.SEEK_END)
        size = thumbnail_file.file.tell()

        thumbnail_file.file.seek(current_position)

    except Exception:
        size = 0

    if size > MAX_THUMBNAIL_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Thumbnail size must be 10 MB or smaller.",
        )


def _generate_video_thumbnail(
    video_path: str,
    thumbnail_path: str,
    duration_sec: float = 0.0,
) -> None:
    """
    Generate an automatic thumbnail from the uploaded video.

    Uses approximately 1 second into the video when possible.
    Falls back to frame 0 for very short videos.
    """

    # Pick a safe timestamp.
    if duration_sec > 2:
        seek_time = min(1.0, max(0.0, duration_sec / 3))
    elif duration_sec > 0:
        seek_time = max(0.0, duration_sec / 2)
    else:
        seek_time = 0.0

    cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        str(seek_time),
        "-i",
        video_path,
        "-frames:v",
        "1",
        "-vf",
        "scale=1280:-2:flags=lanczos",
        "-q:v",
        "2",
        thumbnail_path,
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(
            "Failed to generate video thumbnail:\n"
            f"{result.stderr}"
        )

    if not os.path.exists(thumbnail_path):
        raise RuntimeError(
            "FFmpeg finished but thumbnail was not created."
        )


def _upload_thumbnail(
    thumbnail_path: str,
    video_id: str,
) -> str:
    """
    Upload thumbnail to Cloudinary.

    A stable public_id is used so replacing a thumbnail
    replaces the same logical Cloudinary asset.
    """

    result = cloudinary.uploader.upload(
        thumbnail_path,
        resource_type="image",
        public_id=f"proscenium/{video_id}/thumbnail",
        overwrite=True,
        invalidate=True,
    )

    secure_url = result.get("secure_url")

    if not secure_url:
        raise RuntimeError(
            "Cloudinary did not return a secure thumbnail URL."
        )

    return secure_url


def _prepare_thumbnail(
    thumbnail_file: UploadFile | None,
    raw_path: str,
    video_id: str,
    media_folder: str,
    duration_sec: float = 0.0,
) -> str:
    """
    Prepare the thumbnail for a video.

    If the director uploaded a custom thumbnail:
        -> validate
        -> save temporarily
        -> upload to Cloudinary

    If no custom thumbnail was supplied:
        -> generate thumbnail automatically from video
        -> upload to Cloudinary
    """

    thumbnail_folder = os.path.join(
        media_folder,
        "thumbnail",
    )

    os.makedirs(
        thumbnail_folder,
        exist_ok=True,
    )

    try:

        # ====================================================
        # CUSTOM THUMBNAIL
        # ====================================================

        if (
            thumbnail_file is not None
            and getattr(thumbnail_file, "filename", "")
        ):

            _validate_thumbnail_file(
                thumbnail_file
            )

            content_type = (
                thumbnail_file.content_type or ""
            ).lower()

            extension = _get_thumbnail_extension(
                content_type
            )

            thumbnail_path = os.path.join(
                thumbnail_folder,
                f"thumbnail{extension}",
            )

            try:
                thumbnail_file.file.seek(0)

                with open(
                    thumbnail_path,
                    "wb",
                ) as output_file:
                    shutil.copyfileobj(
                        thumbnail_file.file,
                        output_file,
                    )

                return _upload_thumbnail(
                    thumbnail_path,
                    video_id,
                )

            finally:
                try:
                    thumbnail_file.file.close()
                except Exception:
                    pass

        # ====================================================
        # AUTOMATIC THUMBNAIL
        # ====================================================

        thumbnail_path = os.path.join(
            thumbnail_folder,
            "thumbnail.jpg",
        )

        _generate_video_thumbnail(
            raw_path,
            thumbnail_path,
            duration_sec,
        )

        return _upload_thumbnail(
            thumbnail_path,
            video_id,
        )

    finally:

        # Remove temporary thumbnail files.
        shutil.rmtree(
            thumbnail_folder,
            ignore_errors=True,
        )


# ============================================================
# HLS TRANSCODING
# ============================================================

def _transcode_and_upload_rendition(
    raw_path: str,
    raw_folder: str,
    video_id: str,
    rendition: dict,
    input_path: str,
) -> dict:
    """
    Creates one HLS rendition using FFmpeg.
    """

    label = rendition["label"]

    output_path = os.path.join(
        raw_folder,
        f"index_{label}.m3u8",
    )

    # ========================================================
    # HLS TRANSCODE
    # ========================================================

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        input_path,

        "-vf",
        (
            f"scale={rendition['width']}:"
            f"{rendition['height']}:flags=lanczos"
        ),

        "-c:v",
        "libx264",

        "-preset",
        "fast",

        "-pix_fmt",
        "yuv420p",

        "-c:a",
        "aac",

        "-b:v",
        rendition["v_bitrate"],

        "-b:a",
        "128k",

        "-g",
        "180",

        "-keyint_min",
        "180",

        "-sc_threshold",
        "0",

        "-hls_time",
        "6",

        "-hls_list_size",
        "0",

        "-hls_segment_filename",
        os.path.join(
            raw_folder,
            f"seg_{label}_%03d.ts",
        ),

        "-f",
        "hls",

        output_path,
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg HLS generation failed for {label}:\n"
            f"{result.stderr}"
        )

    # ========================================================
    # FIND HLS SEGMENTS
    # ========================================================

    segment_files = sorted(
        glob.glob(
            os.path.join(
                raw_folder,
                f"seg_{label}_*.ts",
            )
        )
    )

    if not segment_files:
        raise RuntimeError(
            f"No HLS segments were generated for {label}"
        )

    # ========================================================
    # UPLOAD SEGMENTS
    # ========================================================

    segment_urls = []

    for segment_path in segment_files:

        upload_result = cloudinary.uploader.upload(
            segment_path,
            resource_type="video",
            folder=f"proscenium/{video_id}/{label}",
        )

        segment_urls.append(
            upload_result["secure_url"]
        )

    # ========================================================
    # REWRITE PLAYLIST
    # ========================================================

    with open(
        output_path,
        "r",
        encoding="utf-8",
    ) as f:
        lines = f.readlines()

    i = 0
    new_lines = []

    for line in lines:

        if line.startswith("#"):
            new_lines.append(line)

        elif line.strip() == "":
            continue

        else:

            if i >= len(segment_urls):
                raise RuntimeError(
                    f"Playlist references more segments "
                    f"than were uploaded for {label}."
                )

            new_lines.append(
                segment_urls[i] + "\n"
            )

            i += 1

    with open(
        output_path,
        "w",
        encoding="utf-8",
    ) as f:
        f.writelines(new_lines)

    # ========================================================
    # UPLOAD PLAYLIST
    # ========================================================

    index_upload = cloudinary.uploader.upload(
        output_path,
        resource_type="raw",
        folder=f"proscenium/{video_id}",
    )

    return {
        "label": label,
        "returncode": result.returncode,
        "segment_urls": segment_urls,
        "index_url": index_upload["secure_url"],
        "bandwidth": rendition["bandwidth"],
        "resolution": (
            f"{rendition['width']}x"
            f"{rendition['height']}"
        ),
    }


# ============================================================
# AI UPSCALE HELPER
# ============================================================

async def _prepare_hls_input(
    raw_path: str,
    raw_folder: str,
    source_height: int,
    use_upscale: bool = True,
) -> str:
    """
    Prepare the video used for HLS generation.

    Videos below 1080p can be AI-upscaled.
    """

    ai_path = os.path.join(
        raw_folder,
        "ai_upscaled.mp4",
    )

    upscale_engine = os.getenv(
        "UPSCALE_ENGINE",
        "espcn",
    ).lower()

    # ========================================================
    # AI UPSCALING
    # ========================================================

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
                raw_folder,
            )

        elif upscale_engine == "espcn_4x":

            await asyncio.to_thread(
                ai_upscale_video_espcn_4x,
                raw_path,
                ai_path,
                raw_folder,
            )

        else:

            raise RuntimeError(
                f"Unknown UPSCALE_ENGINE: "
                f"{upscale_engine}. "
                f"Currently supported engines are "
                f"'espcn' and 'espcn_4x'."
            )

        if not os.path.exists(ai_path):
            raise RuntimeError(
                "AI upscaling completed but the "
                "upscaled video was not created."
            )

        return ai_path

    # ========================================================
    # ORIGINAL VIDEO
    # ========================================================

    if source_height >= 1080:

        reason = (
            "source is already 1080p or higher"
        )

    else:

        reason = (
            "AI upscaling disabled by uploader"
        )

    print(
        f"[AI] Skipping AI upscaling — {reason}."
    )

    return raw_path


# ============================================================
# BUILD HLS LADDER
# ============================================================

def _build_hls(
    raw_path: str,
    raw_folder: str,
    video_id: str,
    hls_input: str,
) -> tuple[list[dict], str]:

    _, processing_height = _get_video_resolution(
        hls_input
    )

    UPSCALE_TOLERANCE = 1.2

    available_renditions = [
        rendition
        for rendition in RESOLUTION_LADDER
        if rendition["height"]
        <= processing_height * UPSCALE_TOLERANCE
    ]

    if not available_renditions:
        raise RuntimeError(
            "The uploaded video resolution is too small "
            "to create any supported HLS rendition."
        )

    renditions = [
        _transcode_and_upload_rendition(
            raw_path,
            raw_folder,
            video_id,
            rendition,
            input_path=hls_input,
        )
        for rendition in available_renditions
    ]

    # ========================================================
    # MASTER PLAYLIST
    # ========================================================

    master_path = os.path.join(
        raw_folder,
        "master.m3u8",
    )

    stream_blocks = "\n\n".join(
        (
            "#EXT-X-STREAM-INF:"
            f"BANDWIDTH={rendition['bandwidth']},"
            f"RESOLUTION={rendition['resolution']}\n"
            f"{rendition['index_url']}"
        )
        for rendition in renditions
    )

    master_content = (
        "#EXTM3U\n"
        "#EXT-X-VERSION:3\n\n"
        f"{stream_blocks}\n"
    )

    with open(
        master_path,
        "w",
        encoding="utf-8",
    ) as f:
        f.write(master_content)

    # ========================================================
    # UPLOAD MASTER PLAYLIST
    # ========================================================

    master_result = cloudinary.uploader.upload(
        master_path,
        resource_type="raw",
        folder=f"proscenium/{video_id}",
    )

    return (
        renditions,
        master_result["secure_url"],
    )


# ============================================================
# UPLOAD VIDEO
# ============================================================

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
    thumbnail: UploadFile | None = File(None),
    releaseYear: int | None = Form(None),
    useUpscale: str = Form("true"),
    payload: dict = Depends(
        require_role("director", "admin")
    ),
):

    use_upscale = (
        useUpscale.lower() == "true"
    )

    # ========================================================
    # DIRECTOR
    # ========================================================

    try:
        director_oid = ObjectId(
            payload["user_id"]
        )
    except (InvalidId, KeyError):
        raise HTTPException(
            status_code=401,
            detail="Invalid director identity",
        )

    director = directors_collection.find_one(
        {"_id": director_oid}
    )

    if not director:
        raise HTTPException(
            status_code=401,
            detail="Director not found",
        )

    # ========================================================
    # CAST JSON
    # ========================================================

    try:

        cast_list = json.loads(cast)

        if not isinstance(
            cast_list,
            list,
        ):
            raise ValueError

    except (
        json.JSONDecodeError,
        ValueError,
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "cast must be a valid JSON array of "
                "{clientId, name, characterName}"
            ),
        )

    # ========================================================
    # VIDEO ID
    # ========================================================

    video_id = str(
        ObjectId()
    )

    video_oid = ObjectId(
        video_id
    )

    # ========================================================
    # FORM
    # ========================================================

    form = await request.form()

    now = datetime.utcnow()

    cast_doc_ids = []

    # ========================================================
    # CAST
    # ========================================================

    for member in cast_list:

        cast_doc = {
            "videoId": video_oid,
            "name": member.get(
                "name",
                "",
            ),
            "characterName": member.get(
                "characterName",
                "",
            ),
            "photoUrl": None,
            "createdAt": now,
            "updatedAt": now,
        }

        inserted = cast_collection.insert_one(
            cast_doc
        )

        cast_id = inserted.inserted_id

        client_id = member.get(
            "clientId"
        )

        photo_file = (
            form.get(
                f"cast_photo_{client_id}"
            )
            if client_id
            else None
        )

        has_photo = bool(
            photo_file
            and getattr(
                photo_file,
                "filename",
                "",
            )
        )

        if has_photo:

            photo_url = upload_avatar(
                photo_file,
                f"{video_id}_cast_{cast_id}",
            )

            cast_collection.update_one(
                {"_id": cast_id},
                {
                    "$set": {
                        "photoUrl": photo_url
                    }
                },
            )

        cast_doc_ids.append(
            cast_id
        )

    # ========================================================
    # LOCAL MEDIA FOLDERS
    # ========================================================

    video_media_folder = os.path.join(
        media_root,
        video_id,
    )

    raw_folder = os.path.join(
        video_media_folder,
        "raw",
    )

    os.makedirs(
        raw_folder,
        exist_ok=True,
    )

    raw_path = os.path.join(
        raw_folder,
        "original.mp4",
    )

    # ========================================================
    # SAVE ORIGINAL VIDEO
    # ========================================================

    try:

        with open(
            raw_path,
            "wb",
        ) as f:

            shutil.copyfileobj(
                film.file,
                f,
            )

    finally:

        try:
            film.file.close()
        except Exception:
            pass

    # ========================================================
    # VIDEO INFORMATION
    # ========================================================

    duration_sec = _get_video_duration_sec(
        raw_path
    )

    source_width, source_height = (
        _get_video_resolution(
            raw_path
        )
    )

    file_size_bytes = os.path.getsize(
        raw_path
    )

    if source_width <= 0 or source_height <= 0:
        shutil.rmtree(
            video_media_folder,
            ignore_errors=True,
        )

        raise HTTPException(
            status_code=400,
            detail="Could not determine uploaded video resolution.",
        )

    # ========================================================
    # THUMBNAIL
    # ========================================================

    thumbnail_url = _prepare_thumbnail(
        thumbnail_file=thumbnail,
        raw_path=raw_path,
        video_id=video_id,
        media_folder=video_media_folder,
        duration_sec=duration_sec,
    )

    # ========================================================
    # AI UPSCALING
    # ========================================================

    hls_input = await _prepare_hls_input(
        raw_path=raw_path,
        raw_folder=raw_folder,
        source_height=source_height,
        use_upscale=use_upscale,
    )

    # ========================================================
    # HLS
    # ========================================================

    renditions, master_url = _build_hls(
        raw_path=raw_path,
        raw_folder=raw_folder,
        video_id=video_id,
        hls_input=hls_input,
    )

    # ========================================================
    # CLEAN LOCAL MEDIA
    # ========================================================

    if os.path.exists(
        video_media_folder
    ):
        shutil.rmtree(
            video_media_folder
        )

    # ========================================================
    # MONGO DOCUMENT
    # ========================================================

    video_doc = {

        # Stable ID shared with cast/video routes.
        "_id": video_oid,

        "directorId": director_oid,

        "title": title,

        "slug": (
            title
            .lower()
            .replace(" ", "-")
        ),

        "description": description,

        "genres": [
            g.strip()
            for g in genres.split(",")
            if g.strip()
        ],

        "tags": [
            t.strip()
            for t in tags.split(",")
            if t.strip()
        ],

        "language": language,

        "subtitles": [],

        "durationSec": duration_sec,

        "cast": cast_doc_ids,

        # ====================================================
        # THUMBNAIL
        # ====================================================

        "thumbnailUrl": thumbnail_url,

        # ====================================================
        # VIDEO STREAM
        # ====================================================

        "hlsManifestUrl": master_url,

        "rawFileUrl": "",

        "resolutions": [
            r["label"]
            for r in renditions
        ],

        "fileSizeBytes": file_size_bytes,

        "mimeType": (
            film.content_type
            or "video/mp4"
        ),

        # ====================================================
        # STATUS
        # ====================================================

        "status": "ready",

        "visibility": "private",

        "ageRestricted": False,

        "contentWarnings": [],

        # ====================================================
        # MODERATION
        # ====================================================

        "moderationStatus": "pending",

        "moderationComment": None,

        "moderatedBy": None,

        "moderatedAt": None,

        "moderationHistory": [],

        # ====================================================
        # STATS
        # ====================================================

        "views": 0,

        "uniqueViews": 0,

        "likes": 0,

        "dislikes": 0,

        "avgRating": 0,

        "reviewCount": 0,

        "commentCount": 0,

        # ====================================================
        # METADATA
        # ====================================================

        "releaseYear": releaseYear,

        "productionCountry": productionCountry,

        "isFeatured": False,

        "uploadedAt": datetime.utcnow(),

        "publishedAt": None,

        "updatedAt": datetime.utcnow(),
    }

    insert_result = film_collection.insert_one(
        video_doc
    )

    # ========================================================
    # RESPONSE
    # ========================================================

    return {
        "video_id": video_id,

        "mongo_id": str(
            insert_result.inserted_id
        ),

        "message": "Transcoding complete",

        "thumbnailUrl": thumbnail_url,

        "renditions": {
            r["label"]: {
                "status": r["returncode"],
                "index_url": r["index_url"],
                "segment_urls": r["segment_urls"],
            }
            for r in renditions
        },

        "master_url": master_url,
    }


# ============================================================
# REUPLOAD VIDEO
# ============================================================

@router.post("/videos/{video_id}/reupload")
async def reupload_video(
    video_id: str,
    film: UploadFile = File(...),
    thumbnail: UploadFile | None = File(None),
    payload: dict = Depends(
        require_role("director")
    ),
):

    # ========================================================
    # VIDEO ID
    # ========================================================

    try:

        oid = ObjectId(
            video_id
        )

    except InvalidId:

        raise HTTPException(
            status_code=400,
            detail="Invalid video id",
        )

    # ========================================================
    # FIND VIDEO
    # ========================================================

    video = film_collection.find_one(
        {"_id": oid}
    )

    if not video:

        raise HTTPException(
            status_code=404,
            detail="Video not found",
        )

    # ========================================================
    # OWNERSHIP
    # ========================================================

    if (
        str(video["directorId"])
        != payload["user_id"]
    ):

        raise HTTPException(
            status_code=403,
            detail="Not your video",
        )

    # ========================================================
    # LOCAL FOLDERS
    # ========================================================

    video_media_folder = os.path.join(
        media_root,
        video_id,
    )

    raw_folder = os.path.join(
        video_media_folder,
        "raw",
    )

    os.makedirs(
        raw_folder,
        exist_ok=True,
    )

    raw_path = os.path.join(
        raw_folder,
        "original.mp4",
    )

    # ========================================================
    # SAVE NEW VIDEO
    # ========================================================

    try:

        with open(
            raw_path,
            "wb",
        ) as f:

            shutil.copyfileobj(
                film.file,
                f,
            )

    finally:

        try:
            film.file.close()
        except Exception:
            pass

    # ========================================================
    # VIDEO INFO
    # ========================================================

    duration_sec = _get_video_duration_sec(
        raw_path
    )

    source_width, source_height = (
        _get_video_resolution(
            raw_path
        )
    )

    file_size_bytes = os.path.getsize(
        raw_path
    )

    if source_width <= 0 or source_height <= 0:

        shutil.rmtree(
            video_media_folder,
            ignore_errors=True,
        )

        raise HTTPException(
            status_code=400,
            detail="Could not determine uploaded video resolution.",
        )

    # ========================================================
    # THUMBNAIL
    # ========================================================

    new_thumbnail_url = None

    if (
        thumbnail is not None
        and getattr(
            thumbnail,
            "filename",
            "",
        )
    ):

        new_thumbnail_url = _prepare_thumbnail(
            thumbnail_file=thumbnail,
            raw_path=raw_path,
            video_id=video_id,
            media_folder=video_media_folder,
            duration_sec=duration_sec,
        )

    # ========================================================
    # AI UPSCALING
    # ========================================================

    hls_input = await _prepare_hls_input(
        raw_path=raw_path,
        raw_folder=raw_folder,
        source_height=source_height,
        use_upscale=True,
    )

    # ========================================================
    # HLS
    # ========================================================

    renditions, master_url = _build_hls(
        raw_path=raw_path,
        raw_folder=raw_folder,
        video_id=video_id,
        hls_input=hls_input,
    )

    # ========================================================
    # CLEAN LOCAL FILES
    # ========================================================

    if os.path.exists(
        video_media_folder
    ):
        shutil.rmtree(
            video_media_folder
        )

    # ========================================================
    # MODERATION HISTORY
    # ========================================================

    now = datetime.utcnow()

    history_entry = {
        "action": "reuploaded",
        "comment": None,
        "moderatedBy": ObjectId(
            payload["user_id"]
        ),
        "moderatedAt": now,
    }

    # ========================================================
    # MONGO UPDATE
    # ========================================================

    set_fields = {
        "hlsManifestUrl": master_url,

        "resolutions": [
            r["label"]
            for r in renditions
        ],

        "moderationStatus": "pending",

        "moderationComment": None,

        "moderatedBy": None,

        "moderatedAt": None,

        "status": "ready",

        "visibility": "private",

        "publishedAt": None,

        "updatedAt": now,

        "durationSec": duration_sec,

        "fileSizeBytes": file_size_bytes,

        "mimeType": (
            film.content_type
            or "video/mp4"
        ),
    }

    # Only replace thumbnail when the director
    # actually supplied a new one.
    if new_thumbnail_url:

        set_fields[
            "thumbnailUrl"
        ] = new_thumbnail_url

    film_collection.update_one(
        {"_id": oid},
        {
            "$set": set_fields,

            "$push": {
                "moderationHistory": history_entry
            },
        },
    )

    # ========================================================
    # RESPONSE
    # ========================================================

    response = {
        "video_id": video_id,

        "message": (
            "Video reuploaded and "
            "resubmitted for review"
        ),

        "renditions": {
            r["label"]: r["returncode"]
            for r in renditions
        },

        "hlsManifestUrl": master_url,
    }

    if new_thumbnail_url:
        response[
            "thumbnailUrl"
        ] = new_thumbnail_url
    else:
        response[
            "thumbnailUrl"
        ] = video.get("thumbnailUrl")

    return response


# ============================================================
# MODERATION STATUS
# ============================================================

@router.get(
    "/videos/{video_id}/moderation-status"
)
async def get_moderation_status(
    video_id: str,
    payload: dict = Depends(
        require_role("director", "admin")
    ),
):

    try:

        oid = ObjectId(
            video_id
        )

    except InvalidId:

        raise HTTPException(
            status_code=400,
            detail="Invalid video id",
        )

    video = film_collection.find_one(
        {"_id": oid}
    )

    if not video:

        raise HTTPException(
            status_code=404,
            detail="Video not found",
        )

    if (
        payload["role"] == "director"
        and str(video["directorId"])
        != payload["user_id"]
    ):

        raise HTTPException(
            status_code=403,
            detail="Not your video",
        )

    return {
        "videoId": video_id,

        "title": video.get(
            "title"
        ),

        "moderationStatus": video.get(
            "moderationStatus"
        ),

        "comment": video.get(
            "moderationComment"
        ),

        "moderatedAt": video.get(
            "moderatedAt"
        ),
    }


# ============================================================
# RESUBMIT VIDEO
# ============================================================

@router.post(
    "/videos/{video_id}/resubmit"
)
async def resubmit_video(
    video_id: str,
    payload: dict = Depends(
        require_role("director")
    ),
):

    try:

        oid = ObjectId(
            video_id
        )

    except InvalidId:

        raise HTTPException(
            status_code=400,
            detail="Invalid video id",
        )

    video = film_collection.find_one(
        {"_id": oid}
    )

    if not video:

        raise HTTPException(
            status_code=404,
            detail="Video not found",
        )

    if (
        str(video["directorId"])
        != payload["user_id"]
    ):

        raise HTTPException(
            status_code=403,
            detail="Not your video",
        )

    if (
        video.get("moderationStatus")
        != "rejected"
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Only rejected videos can be "
                "resubmitted "
                f"(current status: "
                f"{video.get('moderationStatus')})"
            ),
        )

    now = datetime.utcnow()

    history_entry = {
        "action": "resubmitted",

        "comment": None,

        "moderatedBy": ObjectId(
            payload["user_id"]
        ),

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

            "$push": {
                "moderationHistory": history_entry
            },
        },
    )

    return {
        "message": (
            "Video resubmitted for review"
        ),

        "videoId": video_id,
    }


# ============================================================
# LATEST VIDEO
# ============================================================

@router.get("/latest-video")
async def get_latest_video():

    film = film_collection.find_one(
        {
            "moderationStatus": "approved",
            "visibility": "public",
        },
        sort=[
            (
                "publishedAt",
                -1,
            )
        ],
    )

    if not film:

        return {
            "error": (
                "No approved videos available"
            )
        }

    return {
        "title": film.get(
            "title"
        ),

        "hlsManifestUrl": film.get(
            "hlsManifestUrl"
        ),

        "thumbnailUrl": film.get(
            "thumbnailUrl"
        ),
    }


# ============================================================
# DIRECTOR BIO
# ============================================================

@router.put("/profile/bio")
async def update_director_bio(
    body: BioUpdateRequest,
    payload: dict = Depends(
        require_role("director")
    ),
):

    directors_collection.update_one(
        {
            "_id": ObjectId(
                payload["user_id"]
            )
        },
        {
            "$set": {
                "bio": body.bio,

                "updatedAt": datetime.utcnow(),
            }
        },
    )

    return {
        "message": "Bio updated",
        "bio": body.bio,
    }


# ============================================================
# SERIALIZE VIDEO SUMMARY
# ============================================================

def _serialize_video_summary(
    video: dict,
) -> dict:

    return {
        "id": str(
            video["_id"]
        ),

        "title": video.get(
            "title"
        ),

        "thumbnailUrl": video.get(
            "thumbnailUrl"
        ),

        "status": video.get(
            "status"
        ),

        "moderationStatus": video.get(
            "moderationStatus"
        ),

        "visibility": video.get(
            "visibility"
        ),

        "views": video.get(
            "views",
            0,
        ),

        "durationSec": video.get(
            "durationSec",
            0,
        ),

        "uploadedAt": video.get(
            "uploadedAt"
        ),

        "publishedAt": video.get(
            "publishedAt"
        ),
    }


# ============================================================
# LIST MY VIDEOS
# ============================================================

@router.get("/videos")
async def list_my_videos(
    payload: dict = Depends(
        require_role("director")
    ),
):

    videos = list(
        film_collection.find(
            {
                "directorId": ObjectId(
                    payload["user_id"]
                )
            }
        ).sort(
            "uploadedAt",
            -1,
        )
    )

    return {
        "count": len(videos),

        "videos": [
            _serialize_video_summary(
                video
            )
            for video in videos
        ],
    }


# ============================================================
# GET ONE VIDEO
# ============================================================

@router.get(
    "/videos/{video_id}"
)
async def get_my_video(
    video_id: str,
    payload: dict = Depends(
        require_role("director")
    ),
):

    try:

        oid = ObjectId(
            video_id
        )

    except InvalidId:

        raise HTTPException(
            status_code=400,
            detail="Invalid video id",
        )

    video = film_collection.find_one(
        {"_id": oid}
    )

    if not video:

        raise HTTPException(
            status_code=404,
            detail="Video not found",
        )

    if (
        str(video["directorId"])
        != payload["user_id"]
    ):

        raise HTTPException(
            status_code=403,
            detail="Not your video",
        )

    # ========================================================
    # OBJECT IDS
    # ========================================================

    video["_id"] = str(
        video["_id"]
    )

    video["id"] = video["_id"]

    video["directorId"] = str(
        video["directorId"]
    )

    if video.get("moderatedBy"):

        video["moderatedBy"] = str(
            video["moderatedBy"]
        )

    for entry in video.get(
        "moderationHistory",
        [],
    ):

        if entry.get(
            "moderatedBy"
        ):

            entry["moderatedBy"] = str(
                entry["moderatedBy"]
            )

    # ========================================================
    # CAST
    # ========================================================

    cast_docs = list(
        cast_collection.find(
            {
                "videoId": oid
            }
        )
    )

    for cast_doc in cast_docs:

        cast_doc["_id"] = str(
            cast_doc["_id"]
        )

        cast_doc["videoId"] = str(
            cast_doc["videoId"]
        )

    video["cast"] = cast_docs

    return video


# ============================================================
# DELETE VIDEO
# ============================================================

@router.delete(
    "/videos/{video_id}"
)
async def delete_my_video(
    video_id: str,
    payload: dict = Depends(
        require_role("director")
    ),
):

    try:

        oid = ObjectId(
            video_id
        )

    except InvalidId:

        raise HTTPException(
            status_code=400,
            detail="Invalid video id",
        )

    video = film_collection.find_one(
        {"_id": oid}
    )

    if not video:

        raise HTTPException(
            status_code=404,
            detail="Video not found",
        )

    if (
        str(video["directorId"])
        != payload["user_id"]
    ):

        raise HTTPException(
            status_code=403,
            detail="Not your video",
        )

    # ========================================================
    # CLOUDINARY
    # ========================================================

    _cleanup_cloudinary_assets(
        video_id
    )

    # ========================================================
    # CAST
    # ========================================================

    cast_collection.delete_many(
        {
            "videoId": oid
        }
    )

    # ========================================================
    # VIDEO
    # ========================================================

    film_collection.delete_one(
        {
            "_id": oid
        }
    )

    # ========================================================
    # LOCAL MEDIA
    # ========================================================

    local_video_folder = os.path.join(
        media_root,
        video_id,
    )

    shutil.rmtree(
        local_video_folder,
        ignore_errors=True,
    )

    return {
        "message": "Video deleted",
        "videoId": video_id,
    }


# ============================================================
# UPDATE VIDEO METADATA
# ============================================================

@router.put(
    "/videos/{video_id}"
)
async def update_video_metadata(
    video_id: str,
    request: Request,

    title: str | None = Form(None),

    description: str | None = Form(None),

    genres: str | None = Form(None),

    tags: str | None = Form(None),

    language: str | None = Form(None),

    productionCountry: str | None = Form(None),

    thumbnail: UploadFile | None = File(None),

    releaseYear: int | None = Form(None),

    # JSON array:
    #
    # {
    #   "_id": "...",
    #   "clientId": "...",
    #   "name": "...",
    #   "characterName": "..."
    # }
    #
    cast: str | None = Form(None),

    payload: dict = Depends(
        require_role("director")
    ),
):

    # ========================================================
    # VIDEO ID
    # ========================================================

    try:

        oid = ObjectId(
            video_id
        )

    except InvalidId:

        raise HTTPException(
            status_code=400,
            detail="Invalid video id",
        )

    # ========================================================
    # FIND VIDEO
    # ========================================================

    video = film_collection.find_one(
        {"_id": oid}
    )

    if not video:

        raise HTTPException(
            status_code=404,
            detail="Video not found",
        )

    # ========================================================
    # OWNERSHIP
    # ========================================================

    if (
        str(video["directorId"])
        != payload["user_id"]
    ):

        raise HTTPException(
            status_code=403,
            detail="Not your video",
        )

    # ========================================================
    # UPDATE FIELDS
    # ========================================================

    update_fields: dict[str, Any] = {
        "updatedAt": datetime.utcnow()
    }

    # ========================================================
    # BASIC METADATA
    # ========================================================

    if title is not None:

        update_fields["title"] = title

        update_fields["slug"] = (
            title
            .lower()
            .replace(" ", "-")
        )

    if description is not None:

        update_fields[
            "description"
        ] = description

    if genres is not None:

        update_fields[
            "genres"
        ] = [
            g.strip()
            for g in genres.split(",")
            if g.strip()
        ]

    if tags is not None:

        update_fields[
            "tags"
        ] = [
            t.strip()
            for t in tags.split(",")
            if t.strip()
        ]

    if language is not None:

        update_fields[
            "language"
        ] = language

    if productionCountry is not None:

        update_fields[
            "productionCountry"
        ] = productionCountry

    if releaseYear is not None:

        update_fields[
            "releaseYear"
        ] = releaseYear

    # ========================================================
    # UPDATE THUMBNAIL
    # ========================================================

    if (
        thumbnail is not None
        and getattr(
            thumbnail,
            "filename",
            "",
        )
    ):

        thumbnail_url = _prepare_thumbnail(
            thumbnail_file=thumbnail,
            raw_path="",
            video_id=video_id,
            media_folder=os.path.join(
                media_root,
                video_id,
            ),
            duration_sec=0,
        )

        update_fields[
            "thumbnailUrl"
        ] = thumbnail_url

    # ========================================================
    # UPDATE CAST
    # ========================================================

    if cast is not None:

        try:

            cast_list = json.loads(
                cast
            )

            if not isinstance(
                cast_list,
                list,
            ):
                raise ValueError

        except (
            json.JSONDecodeError,
            ValueError,
        ):

            raise HTTPException(
                status_code=400,
                detail=(
                    "cast must be a valid JSON "
                    "array of {_id?, clientId?, "
                    "name, characterName}"
                ),
            )

        form = await request.form()

        now = datetime.utcnow()

        # ====================================================
        # EXISTING CAST
        # ====================================================

        existing_cast_ids = {
            str(cid)
            for cid in video.get(
                "cast",
                []
            )
        }

        kept_ids = set()

        resolved_cast_ids = []

        # ====================================================
        # PROCESS CAST
        # ====================================================

        for member in cast_list:

            member_id = member.get(
                "_id"
            )

            client_id = member.get(
                "clientId"
            )

            photo_file = (
                form.get(
                    f"cast_photo_{client_id}"
                )
                if client_id
                else None
            )

            has_new_photo = bool(
                photo_file
                and getattr(
                    photo_file,
                    "filename",
                    "",
                )
            )

            # =================================================
            # EXISTING MEMBER
            # =================================================

            if member_id:

                if (
                    member_id
                    not in existing_cast_ids
                ):

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"cast entry "
                            f"{member_id} does not "
                            f"belong to this video"
                        ),
                    )

                kept_ids.add(
                    member_id
                )

                update = {
                    "name": member.get(
                        "name",
                        "",
                    ),

                    "characterName": member.get(
                        "characterName",
                        "",
                    ),

                    "updatedAt": now,
                }

                if has_new_photo:

                    update[
                        "photoUrl"
                    ] = upload_avatar(
                        photo_file,
                        f"{video_id}_cast_{member_id}",
                    )

                cast_collection.update_one(
                    {
                        "_id": ObjectId(
                            member_id
                        )
                    },
                    {
                        "$set": update
                    },
                )

                resolved_cast_ids.append(
                    ObjectId(
                        member_id
                    )
                )

            # =================================================
            # NEW MEMBER
            # =================================================

            else:

                doc = {
                    "videoId": oid,

                    "name": member.get(
                        "name",
                        "",
                    ),

                    "characterName": member.get(
                        "characterName",
                        "",
                    ),

                    "photoUrl": None,

                    "createdAt": now,

                    "updatedAt": now,
                }

                inserted = (
                    cast_collection.insert_one(
                        doc
                    )
                )

                new_id = (
                    inserted.inserted_id
                )

                if has_new_photo:

                    photo_url = upload_avatar(
                        photo_file,
                        f"{video_id}_cast_{new_id}",
                    )

                    cast_collection.update_one(
                        {
                            "_id": new_id
                        },
                        {
                            "$set": {
                                "photoUrl": photo_url
                            }
                        },
                    )

                resolved_cast_ids.append(
                    new_id
                )

        # ====================================================
        # REMOVED CAST
        # ====================================================

        removed_ids = (
            existing_cast_ids
            - kept_ids
        )

        if removed_ids:

            for removed_id in removed_ids:

                delete_cast_photo(
                    video_id,
                    removed_id,
                )

            cast_collection.delete_many(
                {
                    "_id": {
                        "$in": [
                            ObjectId(
                                rid
                            )
                            for rid in removed_ids
                        ]
                    }
                }
            )

        update_fields[
            "cast"
        ] = resolved_cast_ids

    # ========================================================
    # SAVE MONGO UPDATE
    # ========================================================

    film_collection.update_one(
        {"_id": oid},
        {
            "$set": update_fields
        },
    )

    # ========================================================
    # CLEAN LOCAL THUMBNAIL FOLDER
    # ========================================================

    thumbnail_folder = os.path.join(
        media_root,
        video_id,
        "thumbnail",
    )

    shutil.rmtree(
        thumbnail_folder,
        ignore_errors=True,
    )

    return {
        "message": (
            "Video metadata updated"
        ),

        "videoId": video_id,

        "thumbnailUrl": update_fields.get(
            "thumbnailUrl",
            video.get("thumbnailUrl"),
        ),
    }