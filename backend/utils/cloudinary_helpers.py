import os
import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv
from fastapi import UploadFile

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


def upload_avatar(avatar: UploadFile, user_id: str) -> str:
    """
    Uploads a raw avatar image file to Cloudinary and returns its secure URL.
    Does not touch the database — caller is responsible for persisting the
    returned URL onto the relevant user document.
    """
    upload_result = cloudinary.uploader.upload(
        avatar.file,
        resource_type="image",
        folder=f"proscenium/avatars/{user_id}"
    )
    return upload_result["secure_url"]

def _cleanup_cloudinary_assets(video_id: str) -> None:
    """Best-effort deletion of everything uploaded for this video —
    HLS segments, manifests, and cast photos. Failures here are logged,
    not raised, so a Cloudinary hiccup never blocks the Mongo delete."""
    try:
        cloudinary.api.delete_resources_by_prefix(
            f"proscenium/{video_id}", resource_type="video"
        )
    except Exception as e:
        print(f"[cleanup] failed deleting video assets for {video_id}: {e}")

    try:
        cloudinary.api.delete_resources_by_prefix(
            f"proscenium/{video_id}", resource_type="raw"
        )
    except Exception as e:
        print(f"[cleanup] failed deleting manifest assets for {video_id}: {e}")

    try:
        cloudinary.api.delete_resources_by_prefix(
            f"proscenium/avatars/{video_id}_cast_", resource_type="image"
        )
    except Exception as e:
        print(f"[cleanup] failed deleting cast photos for {video_id}: {e}")

def delete_cast_photo(video_id: str, cast_id: str) -> None:
    """Best-effort deletion of a single cast member's photo — used when a
    cast member is removed individually (not the whole video), so this must
    not touch the folder-wide prefix used by _cleanup_cloudinary_assets,
    which would wipe every other cast member's photo too."""
    try:
        cloudinary.api.delete_resources_by_prefix(
            f"proscenium/avatars/{video_id}_cast_{cast_id}", resource_type="image"
        )
    except Exception as e:
        print(f"[cleanup] failed deleting cast photo {cast_id} for {video_id}: {e}")