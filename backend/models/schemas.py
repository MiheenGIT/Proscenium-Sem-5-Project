from pydantic import BaseModel, EmailStr, field_validator
from datetime import date
from typing import Literal, Optional

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
    
# ---------- shared validators (reused across all three) ----------

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


# ---------- Viewer ----------

class ViewerRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    date_of_birth: date
    role: Literal["viewer"] = "viewer"
    genrePreferences: Optional[list[str]] = []
    maturitySetting: Optional[str] = "all"

    @field_validator("username")
    @classmethod
    def username_clean(cls, v):
        return _clean_username(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        return _check_password_strength(v)


# ---------- Creator / Director ----------

class CreatorRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    date_of_birth: date
    role: Literal["director"] = "director"
    studioName: Optional[str] = None
    bio: Optional[str] = None
    portfolioUrl: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_clean(cls, v):
        return _clean_username(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        return _check_password_strength(v)


# ---------- Admin ----------

class AdminRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    date_of_birth: date
    role: Literal["admin"] = "admin"
    adminLevel: Optional[str] = "moderator"  # e.g. "moderator" | "superadmin"

    @field_validator("username")
    @classmethod
    def username_clean(cls, v):
        return _clean_username(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        return _check_password_strength(v)