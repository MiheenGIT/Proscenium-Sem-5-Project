from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterUser(BaseModel):
    username: str
    email: EmailStr
    password: str
    date_of_birth: date
    role: Literal["viewer", "director"] = "viewer"

    @field_validator("username")
    @classmethod
    def username_clean(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if len(v) > 30:
            raise ValueError("Username must be under 30 characters")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


def _clean_username(v: str) -> str:
    v = v.strip()
    if len(v) < 3:
        raise ValueError("Username must be at least 3 characters")
    if len(v) > 30:
        raise ValueError("Username must be under 30 characters")
    return v


def _check_password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    return v


class ViewerRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    date_of_birth: date
    bio: Optional[str] = None
    role: Literal["viewer"] = "viewer"
    genrePreferences: Optional[list[str]] = []
    maturitySetting: Optional[str] = "all"
    avatarUrl: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_clean(cls, v):
        return _clean_username(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        return _check_password_strength(v)


class CreatorRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    date_of_birth: date
    role: Literal["director"] = "director"
    studioName: Optional[str] = None
    bio: Optional[str] = None
    portfolioUrl: Optional[str] = None
    avatarUrl: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_clean(cls, v):
        return _clean_username(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        return _check_password_strength(v)


class AdminRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    date_of_birth: date
    role: Literal["admin"] = "admin"
    adminLevel: Optional[str] = "moderator"
    avatarUrl: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_clean(cls, v):
        return _clean_username(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        return _check_password_strength(v)


class RejectVideoRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Rejection reason must be at least 3 characters")
        if len(v) > 500:
            raise ValueError("Rejection reason must be under 500 characters")
        return v


class ApproveVideoRequest(BaseModel):
    comment: Optional[str] = None

    @field_validator("comment")
    @classmethod
    def comment_length(cls, v):
        if v is None:
            return v
        v = v.strip()
        if len(v) > 500:
            raise ValueError("Comment must be under 500 characters")
        return v or None


class CommentCreateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)

    @field_validator("text")
    @classmethod
    def comment_text_not_blank(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Comment cannot be blank")
        return v


class HeartbeatRequest(BaseModel):
    currentTimeSec: float = Field(..., ge=0)


class BioUpdateRequest(BaseModel):
    bio: str = Field(max_length=1000)


class AvatarUpdateRequest(BaseModel):
    avatarUrl: str = Field(max_length=2000)


class ReactionRequest(BaseModel):
    type: Literal["like", "dislike"]


class ReviewRequest(BaseModel):
    rating: float = Field(..., ge=1, le=5)
    text: str = Field(min_length=1, max_length=1000)

    @field_validator("text")
    @classmethod
    def review_text_not_blank(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Review cannot be blank")
        return v


class ViewerSettingsRequest(BaseModel):
    autoplay: Optional[bool] = None
    defaultQuality: Optional[str] = None
    subtitles: Optional[bool] = None
    emailNotifications: Optional[bool] = None
    newReleaseNotifications: Optional[bool] = None
    recommendationNotifications: Optional[bool] = None
    saveHistory: Optional[bool] = None


class ViewerProfileUpdateRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    bio: Optional[str] = Field(None, max_length=1000)
    genrePreferences: Optional[list[str]] = None
    languagePreferences: Optional[list[str]] = None
    maturitySetting: Optional[str] = None


class CastMember(BaseModel):
    name: str
    characterName: str
    photoUrl: Optional[str] = None

class ContentWarningsRequest(BaseModel):
    contentWarnings: list[str] = Field(default_factory=list)


class AgeRestrictionRequest(BaseModel):
    ageRestricted: bool


class FeaturedRequest(BaseModel):
    isFeatured: bool


class AdminNoteRequest(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


class DirectorSuspendRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class BulkApproveRequest(ApproveVideoRequest):
    videoIds: list[str] = Field(min_length=1, max_length=200)


class BulkRejectRequest(RejectVideoRequest):
    videoIds: list[str] = Field(min_length=1, max_length=200)