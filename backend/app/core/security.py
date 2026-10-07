"""Password hashing and signed access tokens (standard library only)."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from typing import Optional

from app.core.config import settings

_PBKDF2_ITERATIONS = 390_000
_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days
_SECRET_FILE = Path(__file__).resolve().parent.parent / "db" / ".auth_secret"


def _load_secret() -> bytes:
    if settings.secret_key:
        return settings.secret_key.encode("utf-8")
    try:
        if _SECRET_FILE.exists():
            value = _SECRET_FILE.read_text(encoding="utf-8").strip()
            if value:
                return value.encode("utf-8")
        value = secrets.token_hex(32)
        _SECRET_FILE.write_text(value, encoding="utf-8")
        return value.encode("utf-8")
    except OSError:
        # Cannot persist: use a per-process secret (tokens expire on restart).
        return secrets.token_hex(32).encode("utf-8")


_SECRET = _load_secret()


# ---------------------------------------------------------------- passwords
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_hex, digest_hex = stored.split("$")
        if scheme != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


# Used to keep login timing similar when the email does not exist.
DUMMY_HASH = hash_password(secrets.token_hex(8))


# ------------------------------------------------------------------- tokens
def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(signing_input: str) -> str:
    mac = hmac.new(_SECRET, signing_input.encode("ascii"), hashlib.sha256)
    return _b64e(mac.digest())


def create_access_token(user_id: str) -> str:
    header = _b64e(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64e(
        json.dumps(
            {"sub": user_id, "exp": int(time.time()) + _TOKEN_TTL_SECONDS},
            separators=(",", ":"),
        ).encode()
    )
    signing_input = f"{header}.{payload}"
    return f"{signing_input}.{_sign(signing_input)}"


def decode_access_token(token: str) -> Optional[str]:
    """Returns the user id if the token is valid and not expired, else None."""
    try:
        header, payload, signature = token.split(".")
        if not hmac.compare_digest(signature, _sign(f"{header}.{payload}")):
            return None
        data = json.loads(_b64d(payload))
        if int(data.get("exp", 0)) < time.time():
            return None
        sub = data.get("sub")
        return sub if isinstance(sub, str) and sub else None
    except (ValueError, TypeError):
        return None