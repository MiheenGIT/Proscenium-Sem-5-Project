from pydantic import BaseModel, EmailStr, field_validator
from datetime import date
from typing import Literal

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