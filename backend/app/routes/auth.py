from models.schemas import (
    RegisterUser,
    ViewerRegister,
    CreatorRegister,
    AdminRegister,
    DeleteAccountRequest,
)
from fastapi import FastAPI, HTTPException, APIRouter, Depends, Form, UploadFile, File
from database import (
    directors_collection,
    viewers_collection,
    admin_collection,
    account_deletions_collection,
    film_collection,
    comments_collection,
    comment_reactions_collection,
    video_reactions_collection,
    video_reviews_collection,
    review_reactions_collection,
    video_views_collection,
    watch_history_collection,
    watch_sessions_collection,
    watchlist_collection,
    notifications_collection,
    cast_collection,
)
from datetime import datetime, date
from typing import Optional, List
from pydantic import EmailStr, ValidationError
from utils.security import hash_password, verify_password, create_access_token, get_current_user, require_role
from utils.cloudinary_helpers import upload_avatar
from utils.cloudinary_helpers import _cleanup_cloudinary_assets
from bson import ObjectId
router = APIRouter(prefix="/auth", tags=["Auth"])


# ---------- shared helpers ----------

def _safe_errors(exc):
    # JSON-safe validation errors; never echo the submitted values (they can include the password).
    return [{"type": err.get("type"), "loc": list(err.get("loc", [])), "msg": err.get("msg")} for err in exc.errors()]


def _validate_dob(dob_date):
    dob = datetime.combine(dob_date, datetime.min.time())
    if dob > datetime.now():
        raise HTTPException(status_code=400, detail="Date of birth cannot be in the future")
    return dob


def _check_email_unique(email: str):
    # checked across ALL role collections, not just the one being registered
    existing_viewer = viewers_collection.find_one({"email": email})
    existing_creator = directors_collection.find_one({"email": email})
    existing_admin = admin_collection.find_one({"email": email})
    if existing_viewer or existing_creator or existing_admin:
        raise HTTPException(status_code=400, detail="Email already registered")


# ---------- Viewer ----------

@router.post("/register/viewer")
def register_viewer(
    username: str = Form(...),
    email: EmailStr = Form(...),
    password: str = Form(...),
    date_of_birth: date = Form(...),
    bio: Optional[str] = Form(None),
    genrePreferences: Optional[List[str]] = Form(None),
    maturitySetting: Optional[str] = Form("all"),
    gender: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
):
    try:
        user = ViewerRegister(
            username=username, email=email, password=password,
            date_of_birth=date_of_birth,
            bio=bio,
            genrePreferences=genrePreferences or [],
            maturitySetting=maturitySetting,
            gender=gender or None,
        )
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=_safe_errors(e))

    user_data = user.dict()
    dob = _validate_dob(user_data["date_of_birth"])
    email = user_data["email"]
    _check_email_unique(email)

    password_hash = hash_password(user_data.pop("password"))
    now = datetime.utcnow()

    avatar_url = upload_avatar(avatar, username) if avatar else None

    viewer_doc = {
        "username": user_data["username"],
        "email": email,
        "passwordHash": password_hash,
        "date_of_birth": dob,
        "role": "viewer",
        "avatarUrl": avatar_url,
        "bio": user_data.get("bio", None),
        "isBanned": False,
        "banReason": None,
        "bannedAt": None,
        "bannedBy": None,
        "isVerifiedEmail": False,
        "loginCount": 0,
        "genrePreferences": user_data.get("genrePreferences", []),
        "maturitySetting": user_data.get("maturitySetting", "all"),
        "gender": user_data.get("gender"),
        "createdAt": now,
        "updatedAt": now,
    }
    result = viewers_collection.insert_one(viewer_doc)

    return {"message": "Viewer registered successfully", "userId": str(result.inserted_id)}


# ---------- Creator / Director ----------

@router.post("/register/creator")
def register_creator(
    username: str = Form(...),
    email: EmailStr = Form(...),
    password: str = Form(...),
    date_of_birth: date = Form(...),
    studioName: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    portfolioUrl: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
):
    try:
        user = CreatorRegister(
            username=username, email=email, password=password,
            date_of_birth=date_of_birth,
            studioName=studioName, bio=bio, portfolioUrl=portfolioUrl,
        )
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=_safe_errors(e))

    user_data = user.dict()
    dob = _validate_dob(user_data["date_of_birth"])
    email = user_data["email"]
    _check_email_unique(email)

    password_hash = hash_password(user_data.pop("password"))
    now = datetime.utcnow()

    avatar_url = upload_avatar(avatar, username) if avatar else None

    creator_doc = {
        "username": user_data["username"],
        "email": email,
        "passwordHash": password_hash,
        "date_of_birth": dob,
        "role": "director",
        "avatarUrl": avatar_url,
        "bio": user_data.get("bio", None),
        "isBanned": False,
        "banReason": None,
        "bannedAt": None,
        "bannedBy": None,
        "isVerifiedEmail": False,
        "loginCount": 0,
        "studioName": user_data.get("studioName", None),
        "portfolioUrl": user_data.get("portfolioUrl", None),
        "verificationStatus": "pending",
        "uploadsCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    result = directors_collection.insert_one(creator_doc)

    return {"message": "Creator registered successfully", "userId": str(result.inserted_id)}


# ---------- Admin ----------

@router.post("/register/admin")
def register_admin(
    username: str = Form(...),
    email: EmailStr = Form(...),
    password: str = Form(...),
    date_of_birth: date = Form(...),
    adminLevel: Optional[str] = Form("moderator"),
    avatar: Optional[UploadFile] = File(None),
):
    try:
        user = AdminRegister(
            username=username, email=email, password=password,
            date_of_birth=date_of_birth, adminLevel=adminLevel,
        )
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=_safe_errors(e))

    user_data = user.dict()
    dob = _validate_dob(user_data["date_of_birth"])
    email = user_data["email"]
    _check_email_unique(email)

    password_hash = hash_password(user_data.pop("password"))
    now = datetime.utcnow()

    avatar_url = upload_avatar(avatar, username) if avatar else None

    admin_doc = {
        "username": user_data["username"],
        "email": email,
        "passwordHash": password_hash,
        "date_of_birth": dob,
        "role": "admin",
        "avatarUrl": avatar_url,
        "bio": None,
        "isBanned": False,
        "banReason": None,
        "bannedAt": None,
        "bannedBy": None,
        "isVerifiedEmail": False,
        "loginCount": 0,
        "adminLevel": user_data.get("adminLevel", "moderator"),
        "createdAt": now,
        "updatedAt": now,
    }
    result = admin_collection.insert_one(admin_doc)

    return {"message": "Admin registered successfully", "userId": str(result.inserted_id)}

# ---------- Login ----------

@router.post("/login")
def login(credentials: dict):
    email = credentials.get("email")
    password = credentials.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    user = viewers_collection.find_one({"email": email})
    role = "viewer"
    collection = viewers_collection

    if not user:
        user = directors_collection.find_one({"email": email})
        role = "director"
        collection = directors_collection

    if not user:
        user = admin_collection.find_one({"email": email})
        role = "admin"
        collection = admin_collection

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(password, user["passwordHash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.get("isBanned"):
        raise HTTPException(status_code=403, detail=user.get("banReason") or "This account is banned")

    collection.update_one({"_id": user["_id"]}, {"$inc": {"loginCount": 1}})

    token = create_access_token(user_id=str(user["_id"]), role=role)

    return {
        "token": token,
        "token_type": "bearer",
        "role": role,
        "username": user["username"],
        "userId": str(user["_id"]),
    }

# ---------- Protected test route ----------

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {"message": "You are authenticated", "user": current_user}


@router.delete("/account")
def delete_account(
    request: DeleteAccountRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot be deleted here")

    user_id = ObjectId(str(current_user["user_id"]))
    collection = (
        viewers_collection
        if current_user.get("role") == "viewer"
        else directors_collection
    )
    user = collection.find_one({"_id": user_id})
    if not user or not verify_password(request.password, user.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Password is incorrect")

    now = datetime.utcnow()
    member_since = user.get("createdAt")
    days_member = max(0, (now - member_since).days) if isinstance(member_since, datetime) else None
    account_deletions_collection.insert_one({
        "role": current_user.get("role"),
        "reason": request.reason,
        "details": request.details,
        "daysMember": days_member,
        "createdAt": now,
    })

    if current_user.get("role") == "viewer":
        authored_comments = list(comments_collection.find(
            {"viewerId": user_id}, {"_id": 1}
        ))
        authored_reviews = list(video_reviews_collection.find(
            {"viewerId": user_id}, {"_id": 1}
        ))
        comments_collection.update_many(
            {"viewerId": user_id},
            {"$set": {"username": "Deleted user"}, "$unset": {"viewerId": ""}},
        )
        video_reviews_collection.update_many(
            {"viewerId": user_id},
            {"$set": {"username": "Deleted user"}, "$unset": {"viewerId": ""}},
        )
        comment_ids = [row["_id"] for row in authored_comments]
        review_ids = [row["_id"] for row in authored_reviews]
        if comment_ids:
            comment_reactions_collection.delete_many({"commentId": {"$in": comment_ids}})
        if review_ids:
            review_reactions_collection.delete_many({"reviewId": {"$in": review_ids}})
        for related in (
            video_reactions_collection,
            video_views_collection,
            watch_history_collection,
            watch_sessions_collection,
            watchlist_collection,
            notifications_collection,
        ):
            related.delete_many({"viewerId": user_id})
    else:
        films = list(film_collection.find({"directorId": user_id}))
        film_ids = [film["_id"] for film in films]
        for film in films:
            _cleanup_cloudinary_assets(str(film["_id"]), film)
        if film_ids:
            cast_collection.delete_many({"videoId": {"$in": film_ids}})
            comments_collection.delete_many({"videoId": {"$in": film_ids}})
            video_reviews_collection.delete_many({"videoId": {"$in": film_ids}})
            video_reactions_collection.delete_many({"videoId": {"$in": film_ids}})
            video_views_collection.delete_many({"videoId": {"$in": film_ids}})
            watch_history_collection.delete_many({"videoId": {"$in": film_ids}})
            watch_sessions_collection.delete_many({"videoId": {"$in": film_ids}})
            watchlist_collection.delete_many({"videoId": {"$in": film_ids}})
            film_collection.delete_many({"_id": {"$in": film_ids}})

    collection.delete_one({"_id": user_id})
    return {"message": "Account deleted successfully"}

# ---------- Director-only test route ----------

@router.get("/director-only")
def director_only_route(current_user: dict = Depends(require_role("director"))):
    return {"message": "Welcome, director", "user": current_user}