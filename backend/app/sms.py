"""SMS one-time codes for two-step sign-in, sent through Twilio."""
import hmac
import logging
import re
import secrets
from datetime import timedelta

import httpx
from fastapi import HTTPException

from .config import get_settings
from .models import User, utcnow
from .security import token_hash

log = logging.getLogger("zenty.sms")
settings = get_settings()

CODE_TTL = timedelta(minutes=10)
MAX_ATTEMPTS = 5
E164 = re.compile(r"^\+[1-9]\d{7,14}$")


def normalize_phone(raw: str) -> str:
    """Accept '+1 (415) 555-0123' style input and return E.164 ('+14155550123')."""
    digits = re.sub(r"[^\d+]", "", raw or "")
    if digits and not digits.startswith("+"):
        digits = "+1" + digits if len(digits) == 10 else "+" + digits  # assume US/Canada for 10 digits
    if not E164.match(digits):
        raise HTTPException(400, "Enter a valid mobile number, including country code (e.g. +1 415 555 0123).")
    return digits


def _send(to: str, body: str) -> bool:
    if not settings.sms_enabled:
        log.warning("Twilio not configured; SMS to %s… not sent", to[:4])
        return False
    try:
        r = httpx.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_sid}/Messages.json",
            auth=(settings.twilio_sid, settings.twilio_token),
            data={"From": settings.twilio_from, "To": to, "Body": body},
            timeout=10,
        )
        if r.status_code >= 300:
            log.error("Twilio error %s", r.status_code)
            return False
        return True
    except httpx.HTTPError as exc:
        log.error("SMS send failed: %s", type(exc).__name__)
        return False


def make_code(user: User) -> str:
    """Create a fresh 6-digit one-time code; only its hash is stored."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    user.sms_code_hash = token_hash(f"{user.id}:{code}")
    user.sms_code_expires = utcnow() + CODE_TTL
    user.sms_code_attempts = 0
    return code


def issue_code(user: User, purpose: str, to: str | None = None) -> bool:
    """Create a fresh 6-digit code and text it."""
    code = make_code(user)
    text = f"Your Zenty {purpose} code is {code}. It expires in 10 minutes. Never share this code."
    return _send(to or user.phone or "", text)


def check_code(user: User, code: str) -> None:
    """Raise unless the code is right; locks the code after too many tries."""
    code = (code or "").strip()
    if not user.sms_code_hash or not user.sms_code_expires or user.sms_code_expires < utcnow():
        raise HTTPException(400, "That code has expired. Request a new one.")
    if user.sms_code_attempts >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many wrong codes. Request a new one.")
    user.sms_code_attempts += 1
    if not (code.isdigit() and len(code) == 6 and hmac.compare_digest(user.sms_code_hash, token_hash(f"{user.id}:{code}"))):
        raise HTTPException(400, "That code isn't right. Check the text message and try again.")
    user.sms_code_hash = None
    user.sms_code_expires = None
    user.sms_code_attempts = 0
