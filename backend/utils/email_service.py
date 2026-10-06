import html as _html
import os
import smtplib
import ssl
from email.message import EmailMessage

from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465  # SSL

SMTP_USER = os.getenv("SMTP_USER", "prosceniumsem5project@gmail.com")
SMTP_PASSWORD = (os.getenv("SMTP_PASSWORD") or "").replace(" ", "")
ADMIN_NOTIFY_EMAIL = os.getenv("ADMIN_NOTIFY_EMAIL", SMTP_USER)
FRONTEND_URL = (os.getenv("FRONTEND_URL") or "http://localhost:5173").rstrip("/")

# ---------- Brand palette ----------
BG = "#0b0b10"
CARD = "#15151d"
BORDER = "#26262f"
TEXT = "#f2f2f5"
MUTED = "#9a9aa8"
GOLD = "#e8b04b"
GREEN = "#2fbf71"
RED = "#e5484d"
AMBER = "#f5a524"
BLUE = "#4c9aff"
PINK = "#ff5c8a"


def _e(value) -> str:
    """HTML-escape anything user-supplied."""
    return _html.escape(str(value or ""), quote=True)


# ============================================================
# HTML LAYOUT
# ============================================================

def _layout(
    *,
    preheader: str,
    badge: str,
    badge_color: str,
    heading: str,
    intro: str,
    quote_label: str | None = None,
    quote: str | None = None,
    thumbnail_url: str | None = None,
    film_title: str | None = None,
    cta_text: str | None = None,
    cta_url: str | None = None,
    footer_note: str = "",
) -> str:
    thumb_html = ""
    if thumbnail_url:
        thumb_html = f"""
        <tr><td style="padding:0 32px 8px 32px;">
          <img src="{_e(thumbnail_url)}" width="536" alt="{_e(film_title)}"
               style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:10px;">
        </td></tr>"""

    title_html = ""
    if film_title:
        title_html = f"""
        <tr><td style="padding:8px 32px 0 32px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-style:italic;color:{GOLD};">
            &ldquo;{_e(film_title)}&rdquo;
          </div>
        </td></tr>"""

    quote_html = ""
    if quote:
        quote_html = f"""
        <tr><td style="padding:20px 32px 0 32px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:{MUTED};padding-bottom:8px;">
            {_e(quote_label or "Message")}
          </div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:{TEXT};background:{BG};border-left:3px solid {badge_color};border-radius:6px;padding:14px 18px;">
            {_e(quote).replace(chr(10), "<br>")}
          </div>
        </td></tr>"""

    cta_html = ""
    if cta_text and cta_url:
        cta_html = f"""
        <tr><td style="padding:28px 32px 4px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" bgcolor="{GOLD}" style="border-radius:8px;">
              <a href="{_e(cta_url)}" target="_blank"
                 style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#1a1204;text-decoration:none;border-radius:8px;">
                {_e(cta_text)} &rarr;
              </a>
            </td></tr>
          </table>
        </td></tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Proscenium</title>
</head>
<body style="margin:0;padding:0;background:{BG};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{BG};">{_e(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{BG}" style="background:{BG};">
    <tr><td align="center" style="padding:32px 12px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="width:100%;max-width:600px;background:{CARD};border:1px solid {BORDER};border-radius:14px;">

        <!-- Brand bar -->
        <tr><td align="center" style="padding:30px 32px 6px 32px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:8px;color:{GOLD};font-weight:bold;">
            PROSCENIUM
          </div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:4px;color:{MUTED};padding-top:4px;">
            WHERE FILMS TAKE THE STAGE
          </div>
        </td></tr>

        <tr><td style="padding:18px 32px 0 32px;"><div style="height:1px;background:{BORDER};line-height:1px;font-size:1px;">&nbsp;</div></td></tr>

        <!-- Badge -->
        <tr><td style="padding:24px 32px 0 32px;">
          <span style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:{badge_color};border:1px solid {badge_color};border-radius:20px;padding:5px 12px;">
            {_e(badge)}
          </span>
        </td></tr>

        <!-- Heading + intro -->
        <tr><td style="padding:14px 32px 0 32px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:{TEXT};">
            {heading}
          </div>
        </td></tr>
        <tr><td style="padding:12px 32px 16px 32px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:{MUTED};">
            {intro}
          </div>
        </td></tr>

        {thumb_html}
        {title_html}
        {quote_html}
        {cta_html}

        <!-- Footer -->
        <tr><td style="padding:32px 32px 28px 32px;">
          <div style="height:1px;background:{BORDER};line-height:1px;font-size:1px;">&nbsp;</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:{MUTED};padding-top:16px;">
            {footer_note}
            <br>&copy; Proscenium &middot; Made with &hearts; for film lovers
          </div>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>"""


# ============================================================
# SENDING
# ============================================================

def _build_message(to: str, subject: str, text: str, html: str | None, reply_to: str | None = None) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = f"Proscenium <{SMTP_USER}>"
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text)  # plain-text fallback
    if html:
        msg.add_alternative(html, subtype="html")
    return msg


def send_email(
    to: str,
    subject: str,
    body: str,
    reply_to: str | None = None,
    html: str | None = None,
) -> bool:
    """Send an email (HTML + plain-text fallback). Never raises."""
    if not to or not SMTP_PASSWORD:
        print("[EMAIL] Missing recipient or SMTP_PASSWORD, skipping.")
        return False

    try:
        msg = _build_message(to, subject, body, html, reply_to)
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"[EMAIL] Sent '{subject}' to {to}")
        return True
    except Exception as e:
        print(f"[EMAIL] Failed to send to {to}: {e}")
        return False


def send_many(messages: list[tuple]) -> int:
    """
    messages = [(to, subject, text), ...] or [(to, subject, text, html), ...]
    One SMTP login for the whole batch. Returns how many were sent.
    """
    if not SMTP_PASSWORD or not messages:
        return 0

    sent = 0
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            for item in messages:
                to, subject, text = item[0], item[1], item[2]
                html = item[3] if len(item) > 3 else None
                if not to:
                    continue
                try:
                    server.send_message(_build_message(to, subject, text, html))
                    sent += 1
                except Exception as e:
                    print(f"[EMAIL] Failed to send to {to}: {e}")
    except Exception as e:
        print(f"[EMAIL] Batch send failed: {e}")

    print(f"[EMAIL] Batch sent {sent}/{len(messages)}")
    return sent


# ============================================================
# ADMIN -> DIRECTOR
# ============================================================

def notify_director_approved(
    director: dict,
    film_title: str,
    comment: str | None,
    thumbnail_url: str | None = None,
):
    name = director.get("username", "Director")

    text = (
        f"Hi {name},\n\n"
        f'Great news! Your film "{film_title}" has been approved and is now live on Proscenium.\n\n'
    )
    if comment:
        text += f"Message from the admin:\n{comment}\n\n"
    text += f"View your dashboard: {FRONTEND_URL}\n\n- The Proscenium Team"

    html = _layout(
        preheader=f'"{film_title}" is approved and live!',
        badge="Approved",
        badge_color=GREEN,
        heading=f"It&rsquo;s a wrap, {_e(name)}. <span style='color:{GREEN};'>You&rsquo;re live!</span>",
        intro="Our moderators reviewed your film and it&rsquo;s now public on Proscenium, "
              "ready for audiences to watch, rate and review.",
        film_title=film_title,
        thumbnail_url=thumbnail_url,
        quote_label="Note from the admin" if comment else None,
        quote=comment,
        cta_text="Open your dashboard",
        cta_url=FRONTEND_URL,
        footer_note="You&rsquo;re receiving this because you&rsquo;re a director on Proscenium.",
    )
    send_email(director.get("email"), f'Approved: "{film_title}" is live', text, html=html)


def notify_director_rejected(
    director: dict,
    film_title: str,
    reason: str,
    thumbnail_url: str | None = None,
):
    name = director.get("username", "Director")

    text = (
        f"Hi {name},\n\n"
        f'Unfortunately, your film "{film_title}" was not approved.\n\n'
        f"Reason from the admin:\n{reason}\n\n"
        "You can fix the issues and either re-upload the video or resubmit it for review "
        f"from your dashboard: {FRONTEND_URL}\n\n- The Proscenium Team"
    )

    html = _layout(
        preheader=f'"{film_title}" needs changes before it can go live.',
        badge="Changes needed",
        badge_color=RED,
        heading=f"Almost there, {_e(name)}. <span style='color:{RED};'>Not this take.</span>",
        intro="Our moderators reviewed your film and it can&rsquo;t go live yet. "
              "Check the feedback below, then re-upload a fixed version or resubmit it for another look.",
        film_title=film_title,
        thumbnail_url=thumbnail_url,
        quote_label="Reason from the admin",
        quote=reason,
        cta_text="Fix and resubmit",
        cta_url=FRONTEND_URL,
        footer_note="You&rsquo;re receiving this because you&rsquo;re a director on Proscenium.",
    )
    send_email(director.get("email"), f'Update on "{film_title}": changes needed', text, html=html)


# ============================================================
# DIRECTOR -> ADMIN
# ============================================================

def notify_admin_reuploaded(
    director: dict,
    old_title: str,
    new_title: str | None = None,
):
    name = director.get("username", "A director")
    effective_new_title = new_title or old_title

    if new_title and new_title.strip() != old_title.strip():
        display_phrase = f'"{old_title}" with "{new_title}"'
        intro_phrase = (
            f"<strong style='color:{TEXT};'>{_e(name)}</strong> re-uploaded "
            f"&ldquo;{_e(old_title)}&rdquo; with <strong style='color:{GOLD};'>&ldquo;{_e(new_title)}&rdquo;</strong>. "
            "It has been processed and moved back into the moderation queue as <em>pending</em>."
        )
    else:
        display_phrase = f'"{old_title}"'
        intro_phrase = (
            f"<strong style='color:{TEXT};'>{_e(name)}</strong> re-uploaded a new version of "
            f"&ldquo;{_e(old_title)}&rdquo;. "
            "It has been processed and moved back into the moderation queue as <em>pending</em>."
        )

    text = (
        f"{name} has re-uploaded {display_phrase}.\n\n"
        "The film is back in the moderation queue with status: pending."
    )
    html = _layout(
        preheader=f"{name} re-uploaded {display_phrase}",
        badge="New version",
        badge_color=BLUE,
        heading="A fresh cut is waiting for review",
        intro=intro_phrase,
        film_title=effective_new_title,
        cta_text="Open moderation queue",
        cta_url=FRONTEND_URL,
        footer_note="Internal notification for the Proscenium moderation team. Hit reply to write to the director.",
    )
    send_email(
        ADMIN_NOTIFY_EMAIL,
        f"Re-upload: {display_phrase}",
        text,
        reply_to=director.get("email"),
        html=html,
    )


def notify_admin_resubmitted(director: dict, film_title: str):
    name = director.get("username", "A director")

    text = (
        f'{name} has resubmitted "{film_title}" for review after a rejection.\n\n'
        "The film is back in the moderation queue with status: pending."
    )
    html = _layout(
        preheader=f'{name} resubmitted "{film_title}"',
        badge="Resubmitted",
        badge_color=AMBER,
        heading="Second chance, back in the queue",
        intro=f"<strong style='color:{TEXT};'>{_e(name)}</strong> resubmitted their film for review after a rejection. "
              "It&rsquo;s now <em>pending</em> again.",
        film_title=film_title,
        cta_text="Open moderation queue",
        cta_url=FRONTEND_URL,
        footer_note="Internal notification for the Proscenium moderation team. Hit reply to write to the director.",
    )
    send_email(ADMIN_NOTIFY_EMAIL, f'Resubmitted: "{film_title}"', text,
               reply_to=director.get("email"), html=html)


# ============================================================
# VIEWERS
# ============================================================

def build_new_release_message(viewer: dict, video: dict) -> tuple:
    """Returns (to, subject, text, html) for send_many()."""
    name = viewer.get("username", "there")
    title = video.get("title", "A new film")
    description = (video.get("description") or "").strip()
    if len(description) > 220:
        description = description[:217] + "..."
    genres = video.get("genres") or []

    text = f'Hi {name},\n\nA new film just landed on Proscenium: "{title}".\n\n'
    if description:
        text += f"{description}\n\n"
    text += f"Start watching: {FRONTEND_URL}\n\n- The Proscenium Team"

    intro = "A brand-new film just premiered. Grab your popcorn."
    if genres:
        intro += f"<br><span style='color:{GOLD};'>{_e(' · '.join(genres[:3]))}</span>"

    html = _layout(
        preheader=f'New on Proscenium: "{title}"',
        badge="Now showing",
        badge_color=GOLD,
        heading=f"Hi {_e(name)}, <span style='color:{GOLD};'>something new just dropped</span>",
        intro=intro,
        film_title=title,
        thumbnail_url=video.get("thumbnailUrl"),
        quote_label="The story" if description else None,
        quote=description or None,
        cta_text="Watch now",
        cta_url=FRONTEND_URL,
        footer_note="You&rsquo;re receiving this because new-release emails are enabled in your Proscenium settings.",
    )
    return (viewer["email"], f'New on Proscenium: "{title}"', text, html)