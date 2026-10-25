"""Failure Classifier – deduplication, taxonomy, and root-cause hints.

Pure Python, no DB, no browser dependencies.

Pipeline
--------
1. normalise_message()   – strip volatile tokens (UUIDs, timestamps, line #s)
2. fingerprint()         – deterministic SHA-1 of (failure_type, normalised msg)
3. classify()            – maps raw failure_type → canonical category
4. severity_score()      – compute impact level
5. root_cause_hint()     – rule-based diagnostic note
"""

import hashlib
import re
from typing import Any, Dict

# ── Taxonomy ──────────────────────────────────────────────────────────────────
CATEGORIES = {
    "UNCAUGHT_JS_EXCEPTION": "Uncaught JavaScript Exception",
    "SERVER_5XX":            "Server Error (5xx)",
    "DEAD_ASSET_OR_LINK":    "Dead Asset or Broken Link (4xx)",
    "AUTH_OR_SECURITY":      "Authentication / Security Error",
    "NAVIGATION_TIMEOUT":    "Navigation or Network Timeout",
    "RESOURCE_FAILURE":      "Resource Load Failure",
    "UNKNOWN":               "Unknown Failure",
}

_TYPE_TO_CATEGORY: Dict[str, str] = {
    "js_error":         "UNCAUGHT_JS_EXCEPTION",
    "http_error":       "SERVER_5XX",           # refined below by status
    "network_failure":  "RESOURCE_FAILURE",
    "navigation_error": "NAVIGATION_TIMEOUT",
}

# Regex patterns that produce noise in error messages
_VOLATILE_PATTERNS = [
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",  # UUID
    r"\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b",  # ISO timestamp
    r"\bline \d+\b",          # "line 42"
    r"\bcol(?:umn)? \d+\b",   # "col 12"
    r"\bat \w+:\d+:\d+\b",    # "at module:10:5"
    r":\d{3,5}/",             # port numbers in URLs
    r"\?\S+",                 # query strings
    r"#\S+",                  # fragments
    r"\b\d{10,}\b",           # large integers (epoch ms, etc.)
]
_VOLATILE_RE = re.compile("|".join(_VOLATILE_PATTERNS), re.IGNORECASE)


# ── JS error type detection ───────────────────────────────────────────────────
_JS_ERROR_TYPES = {
    "TypeError":          "A value is of the wrong type or a property is accessed on `undefined`/`null`.",
    "ReferenceError":     "A variable or function is used before it is defined (likely a missing script or typo).",
    "SyntaxError":        "Invalid JavaScript syntax in a loaded script file.",
    "RangeError":         "A numeric value is out of an acceptable range (e.g., infinite recursion).",
    "NetworkError":       "A fetch or XHR request was blocked or failed at the network layer.",
    "ChunkLoadError":     "A JavaScript code-split chunk failed to download (deployment or CDN issue).",
}

_HTTP_HINTS = {
    400: "The server rejected the request as malformed. Check form payloads or API parameters.",
    401: "Authentication is required. The user may not be logged in or the token expired.",
    403: "The server refused access. Check CORS policy, permissions, or authentication role.",
    404: "The requested resource does not exist. Check for dead links, broken API routes, or deleted assets.",
    429: "The server is rate-limiting requests. The chaos bot may be clicking too fast.",
    500: "The server threw an unhandled exception. Check server logs for a stack trace.",
    502: "A gateway or reverse-proxy received an invalid response from the upstream server.",
    503: "The service is unavailable. The server may be overloaded or down for maintenance.",
}


def normalise_message(message: str) -> str:
    """Strip volatile tokens so that two instances of the same error hash equally."""
    return _VOLATILE_RE.sub("<X>", message).strip()


def fingerprint(failure_type: str, message: str) -> str:
    """Return a 12-char hex fingerprint for deduplication."""
    normalised = normalise_message(message)
    raw = f"{failure_type}::{normalised}".encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:12]


def classify(failure_type: str, message: str) -> str:
    """Map a raw failure_type to a canonical CATEGORY key."""
    cat = _TYPE_TO_CATEGORY.get(failure_type, "UNKNOWN")

    # Refine http_error by status code extracted from the message
    if failure_type == "http_error":
        m = re.search(r"HTTP (\d{3})", message)
        if m:
            code = int(m.group(1))
            if code in (401, 403):
                cat = "AUTH_OR_SECURITY"
            elif code == 404:
                cat = "DEAD_ASSET_OR_LINK"
            else:
                cat = "SERVER_5XX"

    return cat


def severity_score(failure_type: str, message: str, raw_severity: str) -> str:
    """Upgrade or downgrade severity based on signal strength."""
    # 5xx errors on core pages → always CRITICAL
    if failure_type == "http_error":
        m = re.search(r"HTTP (\d{3})", message)
        if m and int(m.group(1)) >= 500:
            return "critical"
        if m and int(m.group(1)) in (401, 403):
            return "high"
        if m and int(m.group(1)) == 404:
            return "medium"

    # JS exceptions that are TypeError / ReferenceError → high
    if failure_type == "js_error":
        if re.search(r"\b(TypeError|ReferenceError)\b", message):
            return "high"
        if re.search(r"\b(ChunkLoadError|SyntaxError)\b", message):
            return "critical"
        return "medium"

    if failure_type == "navigation_error":
        return "high"

    return raw_severity or "medium"


def root_cause_hint(failure_type: str, message: str, category: str) -> str:
    """Return a plain-English diagnostic note for this failure."""
    # JS error type hints
    if failure_type == "js_error":
        for err_type, hint in _JS_ERROR_TYPES.items():
            if err_type in message:
                # Try to extract the function/variable name
                m = re.search(rf"{err_type}: (.{{0,80}})", message)
                detail = f" Detail: `{m.group(1).strip()}`." if m else ""
                return f"{err_type}: {hint}{detail}"
        return "An uncaught JavaScript error was thrown at runtime. Check the browser console and stack trace."

    # HTTP error hints
    if failure_type == "http_error":
        m = re.search(r"HTTP (\d{3})", message)
        if m:
            code = int(m.group(1))
            return _HTTP_HINTS.get(code, f"The server returned HTTP {code}. Check the server logs.")

    # Network failure
    if failure_type == "network_failure":
        if "net::ERR_CONNECTION_REFUSED" in message:
            return "The server actively refused the connection. The service may be down or the port blocked."
        if "net::ERR_NAME_NOT_RESOLVED" in message:
            return "DNS lookup failed. The hostname cannot be resolved."
        return "A network request failed before reaching the server. Check connectivity and firewall rules."

    # Navigation timeout
    if failure_type == "navigation_error":
        return ("A page navigation timed out or crashed. The server may be too slow, "
                "the URL may be invalid, or a script may be blocking the page load.")

    return "No automated hint available for this failure type."


def enrich(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Take a raw failure dict from failure_detector.detect_failures() and return
    an enriched copy with classification fields added.

    Input keys:  failure_type, message, stack_trace, severity
    Added keys:  fingerprint_hash, category, severity (re-scored), root_cause_hint
    """
    ft  = raw["failure_type"]
    msg = raw["message"] or ""

    cat      = classify(ft, msg)
    sev      = severity_score(ft, msg, raw.get("severity", "medium"))
    fp       = fingerprint(ft, msg)
    hint     = root_cause_hint(ft, msg, cat)

    return {
        **raw,
        "fingerprint_hash": fp,
        "category":         cat,
        "severity":         sev,
        "root_cause_hint":  hint,
    }