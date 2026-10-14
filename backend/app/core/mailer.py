"""Outgoing email: Resend HTTPS API, SMTP, or a console fallback for local dev."""
import asyncio
import json
import smtplib
import ssl
import urllib.request
from email.message import EmailMessage

import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)


def _sender() -> str:
    return (settings.mail_from or settings.smtp_user).strip()


def _send_resend(to: str, subject: str, text: str) -> None:
    payload = json.dumps(
        {"from": _sender(), "to": [to], "subject": subject, "text": text}
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
            "User-Agent": "ai-chaos-tester/0.2",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15):
        pass


def _send_smtp(to: str, subject: str, text: str) -> None:
    msg = EmailMessage()
    msg["From"] = _sender()
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    # Google shows app passwords in groups of four; the spaces are not part of it.
    password = settings.smtp_password.replace(" ", "")
    port = settings.smtp_port
    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(settings.smtp_host, port, timeout=20, context=context) as server:
            if settings.smtp_user:
                server.login(settings.smtp_user, password)
            server.send_message(msg)
        return
    with smtplib.SMTP(settings.smtp_host, port, timeout=20) as server:
        server.ehlo()
        if settings.smtp_starttls:
            server.starttls(context=context)
            server.ehlo()
        if settings.smtp_user:
            server.login(settings.smtp_user, password)
        server.send_message(msg)


def mail_configured() -> bool:
    return bool(settings.resend_api_key or settings.smtp_host)


async def send_email(to: str, subject: str, text: str) -> bool:
    try:
        if settings.resend_api_key:
            await asyncio.to_thread(_send_resend, to, subject, text)
        elif settings.smtp_host:
            await asyncio.to_thread(_send_smtp, to, subject, text)
        else:
            return False
        logger.info("email_sent", subject=subject)
        return True
    except Exception as exc:
        # Shows up in the Render logs, e.g. SMTPAuthenticationError or TimeoutError.
        logger.error("email_delivery_failed", error_type=type(exc).__name__, error=str(exc)[:200])
        return False


async def send_reset_email(to: str, link: str) -> None:
    subject = "Reset your AI Chaos Tester password"
    text = (
        "Someone asked to reset the password for this account.\n\n"
        f"Reset it here (the link expires in 30 minutes):\n{link}\n\n"
        "If you did not ask for this, you can ignore this email."
    )
    if not mail_configured():
        logger.warning("Email is not configured. Password reset link below", to=to, link=link)
        return
    await send_email(to, subject, text)