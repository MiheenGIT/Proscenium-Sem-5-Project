FLAGGED_KEYWORDS = [
    "kill you", "hurt you", "hate you", "hate speech",
    "rape", "suicide", "self harm", "self-harm",
    "kill yourself", "die die die",
    # add more terms relevant to your platform's moderation policy —
    # keep them lowercase, this list is matched against lowercased text
]


def check_comment_text(text: str) -> dict:
    """
    Local keyword-based moderation check. Returns the same shape the
    rest of the codebase expects:
    { "flagged": bool, "categories": [...matched terms...], "raw": None, "checkFailed": False }
    No external dependency, no rate limits, always succeeds.
    """
    lowered = text.lower()
    matched = [kw for kw in FLAGGED_KEYWORDS if kw in lowered]

    return {
        "flagged": len(matched) > 0,
        "categories": matched,
        "raw": None,
        "checkFailed": False,
    }