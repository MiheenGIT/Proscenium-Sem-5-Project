from fastapi import APIRouter, UploadFile, File, Form
import os, shutil
from bson import ObjectId
import subprocess
import glob
import cloudinary
import cloudinary.uploader
from database import film_collection

from database import db
from datetime import datetime

router = APIRouter(prefix='/directors', tags=["directors"])
media_root = "media"

@router.post("/upload-video")
async def upload_vid(
    title: str = Form(...),
    description: str = Form(...),
    film: UploadFile = File(...)
):
    video_id = str(ObjectId())

    raw_folder= os.path.join(media_root, video_id, "raw")
    os.makedirs(raw_folder, exist_ok=True)

    raw_path= os.path.join(raw_folder, "original.mp4")

    with open(raw_path, "wb") as f:
        shutil.copyfileobj(film.file, f)

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
        "directorId": None,  # TODO: replace with real logged-in director's _id once auth is wired into this route
        "title": title,
        "slug": title.lower().replace(" ", "-"),
        "description": description,
        "genres": [],
        "tags": [],
        "language": "",
        "subtitles": [],
        "durationSec": 0,
        "thumbnailUrl": "",
        "hlsManifestUrl": master_result["secure_url"],
        "rawFileUrl": "",  # raw file was deleted locally, leave blank unless you keep a cloud copy
        "resolutions": ["480p", "720p"],
        "fileSizeBytes": 0,
        "mimeType": "video/mp4",
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
        "releaseYear": None,
        "productionCountry": "",
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

@router.get("/latest-video")
async def get_latest_video():
    film = film_collection.find_one(sort=[("uploadedAt", -1)])
    if not film:
        return {"error": "No videos found in database"}
    return {
        "title": film.get("title"),
        "hlsManifestUrl": film.get("hlsManifestUrl")
    }