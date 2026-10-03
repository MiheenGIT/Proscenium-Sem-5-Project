import os
import re
import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv
from fastapi import UploadFile

load_dotenv()

# ============================================================
# MULTI-ACCOUNT SUPPORT
# ============================================================
# cloudinary.config() is global/per-process. These helpers temporarily
# repoint it at whichever account a given asset actually lives on
# (resolved from the asset's own URL), then restore the default account
# used for all new uploads. NOT concurrency-safe — two requests racing
# across different accounts at the same instant could briefly see the
# wrong config. Acceptable for this project's traffic; would need
# per-call client instances (not global config) to be safe at scale.

CLOUDINARY_ACCOUNTS = {
    os.getenv("CLOUDINARY_CLOUD_NAME"): {
        "cloud_name": os.getenv("CLOUDINARY_CLOUD_NAME"),
        "api_key": os.getenv("CLOUDINARY_API_KEY"),
        "api_secret": os.getenv("CLOUDINARY_API_SECRET"),
    },
    os.getenv("CLOUDINARY_OLD_CLOUD_NAME"): {
        "cloud_name": os.getenv("CLOUDINARY_OLD_CLOUD_NAME"),
        "api_key": os.getenv("CLOUDINARY_OLD_API_KEY"),
        "api_secret": os.getenv("CLOUDINARY_OLD_API_SECRET"),
    },
}


def configure_default() -> None:
    """Point the global cloudinary SDK at the account used for new uploads."""
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    )


def _extract_cloud_name(url: str | None) -> str | None:
    if not url:
        return None
    match = re.search(r"res\.cloudinary\.com/([^/]+)/", url)
    return match.group(1) if match else None


def configure_for_cloud_name(cloud_name: str | None) -> None:
    """Point the SDK at the account matching cloud_name, falling back to
    the default account if cloud_name is unknown/unset."""
    account = CLOUDINARY_ACCOUNTS.get(cloud_name)

    if account and account["api_key"]:
        cloudinary.config(
            cloud_name=account["cloud_name"],
            api_key=account["api_key"],
            api_secret=account["api_secret"],
        )
    else:
        configure_default()


def configure_for_video(video: dict) -> None:
    """Point the SDK at whichever account this video's assets live in."""
    url = video.get("hlsManifestUrl") or video.get("thumbnailUrl") or ""
    configure_for_cloud_name(_extract_cloud_name(url))


configure_default()


# ============================================================
# AVATAR / CAST PHOTO UPLOAD
# ============================================================

def upload_avatar(
    avatar: UploadFile,
    user_id: str,
    previous_url: str | None = None,
) -> str:
    """
    Uploads an avatar or cast-photo image using a STABLE public_id
    (proscenium/avatars/<user_id>) so repeat uploads overwrite the same
    asset instead of piling up new files forever.

    If previous_url points at a DIFFERENT Cloudinary account than the
    current default, the old asset there is best-effort deleted (failures
    logged, never raised) so switching .env accounts doesn't orphan
    storage on the old account.
    """
    default_cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")

    if previous_url:
        old_cloud_name = _extract_cloud_name(previous_url)

        if old_cloud_name and old_cloud_name != default_cloud_name:
            try:
                configure_for_cloud_name(old_cloud_name)
                cloudinary.api.delete_resources_by_prefix(
                    f"proscenium/avatars/{user_id}", resource_type="image"
                )
            except Exception as e:
                print(f"[cleanup] failed deleting old avatar for {user_id}: {e}")
            finally:
                configure_default()

    configure_default()

    upload_result = cloudinary.uploader.upload(
        avatar.file,
        resource_type="image",
        public_id=f"proscenium/avatars/{user_id}",
        overwrite=True,
        invalidate=True,
    )

    return upload_result["secure_url"]


# ============================================================
# VIDEO THUMBNAIL CLEANUP (cross-account only)
# ============================================================

def cleanup_old_thumbnail(video_id: str, previous_thumbnail_url: str | None) -> None:
    """Best-effort delete of a video's previous thumbnail, only when it
    lived on a DIFFERENT account than the current default — same-account
    replacement is already handled by _upload_thumbnail's overwrite=True."""
    if not previous_thumbnail_url:
        return

    old_cloud_name = _extract_cloud_name(previous_thumbnail_url)
    default_cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")

    if not old_cloud_name or old_cloud_name == default_cloud_name:
        return

    try:
        configure_for_cloud_name(old_cloud_name)
        cloudinary.uploader.destroy(
            f"proscenium/{video_id}/thumbnail",
            resource_type="image",
            invalidate=True,
        )
    except Exception as e:
        print(f"[cleanup] failed deleting old thumbnail for {video_id}: {e}")
    finally:
        configure_default()


# ============================================================
# VIDEO / MANIFEST DELETION
# ============================================================

def _delete_video_and_raw_assets(video_id: str) -> None:
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


def _cleanup_cloudinary_assets(video_id: str, video: dict | None = None) -> None:
    """Best-effort deletion of EVERYTHING for this video — segments,
    manifests, cast photos — used when the video itself is deleted.
    Resolves the correct account from `video`'s stored URLs first."""
    if video:
        configure_for_video(video)

    _delete_video_and_raw_assets(video_id)

    try:
        cloudinary.api.delete_resources_by_prefix(
            f"proscenium/avatars/{video_id}_cast_", resource_type="image"
        )
    except Exception as e:
        print(f"[cleanup] failed deleting cast photos for {video_id}: {e}")

    configure_default()


def cleanup_old_video_renditions(video_id: str, previous_video: dict) -> None:
    """Best-effort deletion of a video's PREVIOUS renditions/manifest
    after a reupload creates brand-new ones elsewhere. Does NOT touch
    cast photos — a reupload doesn't replace those."""
    configure_for_video(previous_video)
    _delete_video_and_raw_assets(video_id)
    configure_default()


def delete_cast_photo(
    video_id: str,
    cast_id: str,
    video: dict | None = None,
) -> None:
    """Best-effort deletion of a single cast member's photo. Resolves the
    correct account from `video`'s stored URLs before deleting."""
    if video:
        configure_for_video(video)

    try:
        cloudinary.api.delete_resources_by_prefix(
            f"proscenium/avatars/{video_id}_cast_{cast_id}", resource_type="image"
        )
    except Exception as e:
        print(f"[cleanup] failed deleting cast photo {cast_id} for {video_id}: {e}")

    configure_default()