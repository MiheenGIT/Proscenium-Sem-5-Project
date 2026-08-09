from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from utils.security import require_role
from utils.cloudinary_helpers import upload_avatar
import os, shutil
from bson import ObjectId
import subprocess
import glob
import cloudinary
import cloudinary.uploader
from database import film_collection, directors_collection
from models.schemas import BioUpdateRequest
from database import db
from datetime import datetime
import json 
from bson.errors import InvalidId

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

@router.post("/upload-video")
async def upload_vid(
    title: str = Form(...),
    description: str = Form(...),
    film: UploadFile = File(...),
    genres: str = Form(""),
    tags: str = Form(""),
    language: str = Form(""),
    productionCountry: str = Form(""),
    cast: str = Form("[]"),          # JSON string, e.g. '[{"name":"Jane Doe","characterName":"Detective Rao"}]' — no photoUrl, see castPhotos
    castPhotos: list[UploadFile] = File([]),  # image files, same order as entries in `cast`
    thumbnailUrl: str = Form(""),
    releaseYear: int | None = Form(None),
    payload: dict = Depends(require_role("director", "admin"))
):
    director = directors_collection.find_one({"_id": ObjectId(payload["user_id"])})
    if not director:
        raise HTTPException(status_code=401, detail="Director not found")

    try:
        cast_list = json.loads(cast)
        if not isinstance(cast_list, list):
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="cast must be a valid JSON array of {name, characterName}")

    if castPhotos and len(castPhotos) != len(cast_list):
        raise HTTPException(
            status_code=400,
            detail=f"castPhotos count ({len(castPhotos)}) must match cast entries count ({len(cast_list)})"
        )

    video_id = str(ObjectId())

    for idx, member in enumerate(cast_list):
        if castPhotos:
            member["photoUrl"] = upload_avatar(castPhotos[idx], f"{video_id}_cast_{idx}")
        else:
            member["photoUrl"] = None

    raw_folder= os.path.join(media_root, video_id, "raw")
    os.makedirs(raw_folder, exist_ok=True)

    raw_path= os.path.join(raw_folder, "original.mp4")

    with open(raw_path, "wb") as f:
        shutil.copyfileobj(film.file, f)

    duration_sec = _get_video_duration_sec(raw_path)
    file_size_bytes = os.path.getsize(raw_path)

    output_480p_path = os.path.join(raw_folder, "index.m3u8")

    cmd_480p = [
        "ffmpeg",
        "-i", raw_path,
        "-vf", "scale=854:480",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-b:v", "1000k",
        "-b:a", "128k",
        "-g", "180",
        "-keyint_min", "180",
        "-sc_threshold", "0",
        "-hls_time", "6",
        "-hls_list_size", "0",
        "-hls_segment_filename", os.path.join(raw_folder, "seg_%03d.ts"),
        "-f", "hls",
        output_480p_path
    ]

    result480p = subprocess.run(cmd_480p, capture_output=True, text=True)

    segment_files = sorted(glob.glob(os.path.join(raw_folder, "seg_*.ts")))
    
    segment_urls_480p = []

    for segment_path in segment_files:
        result = cloudinary.uploader.upload(
            segment_path,
            resource_type="video",
            folder=f"proscenium/{video_id}/480p"
        )
        segment_urls_480p.append(result["secure_url"])

    with open(output_480p_path, "r") as f:
        lines = f.readlines()

    i=0
    new_lines=[]

    for segs in lines:
        if segs.startswith("#"):
            new_lines.append(segs)
        elif segs.strip() == "":
            continue  # skip blank lines entirely
        else:
            new_lines.append(segment_urls_480p[i] + "\n")
            i += 1

    with open(output_480p_path, "w") as f:
        f.writelines(new_lines)

    index_480p_upload = cloudinary.uploader.upload(
        output_480p_path,
        resource_type="raw",
        folder=f"proscenium/{video_id}"
    )

    index_480p_url = index_480p_upload["secure_url"]

    output_720p_path = os.path.join(raw_folder, "index720.m3u8")

    cmd_720p = [
        "ffmpeg",
        "-i", raw_path,
        "-vf", "scale=1280:720",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-b:v", "2500k",
        "-b:a", "128k",
        "-g", "180",
        "-keyint_min", "180",
        "-sc_threshold", "0",
        "-hls_time", "6",
        "-hls_list_size", "0",
        "-hls_segment_filename", os.path.join(raw_folder, "seg720_%03d.ts"),
        "-f", "hls",
        output_720p_path
    ]

    result720p = subprocess.run(cmd_720p, capture_output=True, text=True)

    segment_files = sorted(glob.glob(os.path.join(raw_folder, "seg720_*.ts")))

    segment_urls_720p = []

    for segment_path in segment_files:
        result = cloudinary.uploader.upload(
            segment_path,
            resource_type="video",
            folder=f"proscenium/{video_id}/720p"
        )
        segment_urls_720p.append(result["secure_url"])

    with open(output_720p_path, "r") as f:
        lines = f.readlines()

    i=0
    new_lines=[]

    for segs in lines:
        if segs.startswith("#"):
            new_lines.append(segs)
        elif segs.strip() == "":
            continue  # skip blank lines entirely
        else:
            new_lines.append(segment_urls_720p[i] + "\n")
            i += 1

    with open(output_720p_path, "w") as f:
        f.writelines(new_lines)

    index_720p_upload = cloudinary.uploader.upload(
        output_720p_path,
        resource_type="raw",
        folder=f"proscenium/{video_id}"
    )

    index_720p_url = index_720p_upload["secure_url"]


    master_path= os.path.join(raw_folder, "master.m3u8")

    master_content = f"""#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480
{index_480p_url}

#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
{index_720p_url}
"""

    with open(master_path, "w") as f:
        f.write(master_content)

    master_result = cloudinary.uploader.upload(
        master_path,
        resource_type="raw",
        folder=f"proscenium/{video_id}"
    )

    shutil.rmtree(raw_folder)
    video_doc = {
        "directorId": ObjectId(payload["user_id"]),  # TODO: replace with real logged-in director's _id once auth is wired into this route
        "title": title,
        "slug": title.lower().replace(" ", "-"),
        "description": description,
        "genres": [g.strip() for g in genres.split(",") if g.strip()],
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
        "language": language,
        "subtitles": [],
        "durationSec": duration_sec,
        "cast": cast_list,
        "thumbnailUrl": thumbnailUrl,
        "hlsManifestUrl": master_result["secure_url"],
        "rawFileUrl": "",  # raw file was deleted locally, leave blank unless you keep a cloud copy
        "resolutions": ["480p", "720p"],
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
            "480p_status": result480p.returncode,
            "720p_status": result720p.returncode,
            "480p_segment_urls": segment_urls_480p,
            "720p_segment_urls": segment_urls_720p,
            "index_480_url": index_480p_url,
            "index_720_url": index_720p_url,
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
    file_size_bytes = os.path.getsize(raw_path)

    # ---- 480p ----
    output_480p_path = os.path.join(raw_folder, "index.m3u8")
    cmd_480p = [
        "ffmpeg",
        "-i", raw_path,
        "-vf", "scale=854:480",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-b:v", "1000k",
        "-b:a", "128k",
        "-g", "180",
        "-keyint_min", "180",
        "-sc_threshold", "0",
        "-hls_time", "6",
        "-hls_list_size", "0",
        "-hls_segment_filename", os.path.join(raw_folder, "seg_%03d.ts"),
        "-f", "hls",
        output_480p_path
    ]
    result480p = subprocess.run(cmd_480p, capture_output=True, text=True)

    segment_files = sorted(glob.glob(os.path.join(raw_folder, "seg_*.ts")))
    segment_urls_480p = []
    for segment_path in segment_files:
        result = cloudinary.uploader.upload(
            segment_path,
            resource_type="video",
            folder=f"proscenium/{video_id}/480p"
        )
        segment_urls_480p.append(result["secure_url"])

    with open(output_480p_path, "r") as f:
        lines = f.readlines()

    i = 0
    new_lines = []
    for segs in lines:
        if segs.startswith("#"):
            new_lines.append(segs)
        elif segs.strip() == "":
            continue
        else:
            new_lines.append(segment_urls_480p[i] + "\n")
            i += 1

    with open(output_480p_path, "w") as f:
        f.writelines(new_lines)

    index_480p_upload = cloudinary.uploader.upload(
        output_480p_path,
        resource_type="raw",
        folder=f"proscenium/{video_id}"
    )
    index_480p_url = index_480p_upload["secure_url"]

    # ---- 720p ----
    output_720p_path = os.path.join(raw_folder, "index720.m3u8")
    cmd_720p = [
        "ffmpeg",
        "-i", raw_path,
        "-vf", "scale=1280:720",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-b:v", "2500k",
        "-b:a", "128k",
        "-g", "180",
        "-keyint_min", "180",
        "-sc_threshold", "0",
        "-hls_time", "6",
        "-hls_list_size", "0",
        "-hls_segment_filename", os.path.join(raw_folder, "seg720_%03d.ts"),
        "-f", "hls",
        output_720p_path
    ]
    result720p = subprocess.run(cmd_720p, capture_output=True, text=True)

    segment_files = sorted(glob.glob(os.path.join(raw_folder, "seg720_*.ts")))
    segment_urls_720p = []
    for segment_path in segment_files:
        result = cloudinary.uploader.upload(
            segment_path,
            resource_type="video",
            folder=f"proscenium/{video_id}/720p"
        )
        segment_urls_720p.append(result["secure_url"])

    with open(output_720p_path, "r") as f:
        lines = f.readlines()

    i = 0
    new_lines = []
    for segs in lines:
        if segs.startswith("#"):
            new_lines.append(segs)
        elif segs.strip() == "":
            continue
        else:
            new_lines.append(segment_urls_720p[i] + "\n")
            i += 1

    with open(output_720p_path, "w") as f:
        f.writelines(new_lines)

    index_720p_upload = cloudinary.uploader.upload(
        output_720p_path,
        resource_type="raw",
        folder=f"proscenium/{video_id}"
    )
    index_720p_url = index_720p_upload["secure_url"]

    # ---- master manifest ----
    master_path = os.path.join(raw_folder, "master.m3u8")
    master_content = f"""#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480
{index_480p_url}

#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
{index_720p_url}
"""
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
        "480p_status": result480p.returncode,
        "720p_status": result720p.returncode,
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