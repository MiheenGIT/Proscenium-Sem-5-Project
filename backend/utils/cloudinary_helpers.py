import os
import cloudinary
import cloudinary.uploader
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