import re
import unicodedata


# ============================================================
# BLOCKED / FLAGGED KEYWORDS
# ============================================================

FLAGGED_KEYWORDS = {
    # Threats / harmful language
    "kill you",
    "kill yourself",
    "hurt you",
    "i will hurt you",
    "i'll hurt you",
    "hate you",
    "hate speech",
    "rape",
    "suicide",
    "self harm",
    "self-harm",
    "die die die",

    # Profanity / abusive language
    "fuck",
    "fucker",
    "fucking",
    "motherfucker",
    "bitch",
    "bastard",
    "asshole",
    "bullshit",
    "cunt",
    "dickhead",
    "shithead",
    "shit",
}


# ============================================================
# NORMALIZATION
# ============================================================

def _normalize_text(text: str) -> str:
    """
    Normalize text so simple attempts to bypass moderation
    are less effective.

    Examples:

        "FUCK"       -> "fuck"
        "f.u.c.k"    -> "fuck"
        "f-u-c-k"    -> "fuck"
    """

    if not isinstance(text, str):
        return ""

    text = unicodedata.normalize(
        "NFKC",
        text,
    )

    text = text.lower()

    # Remove common separator characters used
    # to bypass word filters.
    text = re.sub(
        r"[\s._\-]+",
        " ",
        text,
    )

    return text.strip()


# ============================================================
# COMMENT MODERATION
# ============================================================

def check_comment_text(text: str) -> dict:
    """
    Local deterministic moderation.

    This function does NOT depend on:

        - OpenAI
        - Cloudinary
        - internet
        - external APIs
        - AI services

    It can be used later by the Admin moderation system.

    Returns:

        {
            "flagged": bool,
            "categories": [...],
            "raw": None,
            "checkFailed": False
        }
    """

    try:
        normalized = _normalize_text(text)

        matched = []

        for keyword in FLAGGED_KEYWORDS:
            normalized_keyword = _normalize_text(
                keyword
            )

            if (
                normalized_keyword
                and normalized_keyword in normalized
            ):
                matched.append(keyword)

        return {
            "flagged": bool(matched),
            "categories": sorted(
                set(matched)
            ),
            "raw": None,
            "checkFailed": False,
        }

    except Exception:
        return {
            "flagged": False,
            "categories": [],
            "raw": None,
            "checkFailed": True,
        }