"""Crawl policy: decides what the chaos bot does next.

Pure Python (no browser, no database), so it is easy to test.

- "Maximum pages"       = unique pages of the target site that get visited.
- "Maximum crawl depth" = link distance from the start page (start page = depth 0).
- Every page gets a few chaos interactions (fill / check / click), then the bot
  moves on to a page it has not seen yet. It never wanders off the target site.
"""
import random
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
from urllib.parse import urldefrag, urlparse, urlunparse

INTERACTIONS_PER_PAGE = 4        # fill / check / click steps on a page that still has links to follow
STEPS_PER_PAGE = INTERACTIONS_PER_PAGE + 1
MAX_OFFSITE_RETURNS = 3          # how often the bot may be sent back after leaving the site

_PRIORITY = {"fill": 1, "check": 2, "click": 3}
_SKIP_EXT = (
    ".pdf", ".zip", ".rar", ".7z", ".gz", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
    ".mp3", ".mp4", ".mov", ".avi", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".exe", ".dmg", ".apk",
)


def _site(url: str) -> str:
    """Host (without 'www.') plus port, used to decide if two URLs are the same site."""
    try:
        p = urlparse(url)
        host = (p.hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        return f"{host}:{p.port}" if p.port else host
    except ValueError:
        return ""


def normalize_url(url: str) -> str:
    """Same page, same string: no fragment, no trailing slash, no 'www.'."""
    try:
        clean, _ = urldefrag(url.strip())
        p = urlparse(clean)
        path = p.path or "/"
        if len(path) > 1 and path.endswith("/"):
            path = path[:-1]
        return urlunparse((p.scheme.lower(), _site(clean), path, "", p.query, ""))
    except ValueError:
        return url


def _crawlable(href: str) -> bool:
    try:
        p = urlparse(href)
    except ValueError:
        return False
    if p.scheme not in ("http", "https"):
        return False
    return not p.path.lower().endswith(_SKIP_EXT)


class CrawlPolicy:
    def __init__(self, start_url: str, max_pages: int, max_depth: int) -> None:
        self.max_pages = max(1, int(max_pages))
        self.max_depth = max(0, int(max_depth))
        self.site = _site(start_url)
        self.visited: Dict[str, int] = {}                  # normalized url -> depth
        self.frontier: Dict[str, Tuple[str, int]] = {}     # normalized url -> (href, depth)
        self.used: Dict[str, int] = {}                     # interactions spent per page
        self.done: Set[Tuple[str, str, Optional[str]]] = set()
        self.current: Optional[str] = None                 # normalized url of the page we are on
        self.last_onsite: Optional[str] = None             # real url of the last page on the site
        self._arrival_depth: Optional[int] = None
        self._offsite_returns = 0

    # ------------------------------------------------------------------ observe
    def observe(self, url: str, hrefs: Iterable[str]) -> Tuple[str, int]:
        """Register the page the browser is on.

        Returns (verdict, depth). verdict is:
          "ok"      the page counts, carry on
          "limit"   a new page, but the page limit is already reached: stop the run
          "offsite" the browser left the site, or went deeper than allowed: go back
        """
        prev = self.current
        if not self.visited:
            self.site = _site(url)  # the start URL may redirect (http -> https, www, ...)
        elif _site(url) != self.site:
            self.current = None
            return "offsite", 0

        cur = normalize_url(url)
        if cur not in self.visited:
            if len(self.visited) >= self.max_pages:
                self.current = None
                return "limit", 0
            if self._arrival_depth is not None:
                depth = self._arrival_depth
            elif prev is not None:
                depth = self.visited.get(prev, 0) + 1
            else:
                depth = 0
            if depth > self.max_depth:
                self.current = None
                self._arrival_depth = None
                return "offsite", depth
            self.visited[cur] = depth
        self._arrival_depth = None
        self.current = cur
        self.last_onsite = url
        self.frontier.pop(cur, None)

        depth = self.visited[cur]
        if depth < self.max_depth:
            for href in hrefs:
                if not href or not _crawlable(href) or _site(href) != self.site:
                    continue
                n = normalize_url(href)
                if n == cur or n in self.visited:
                    continue
                known = self.frontier.get(n)
                if known is None or known[1] > depth + 1:
                    self.frontier[n] = (href, depth + 1)
        return "ok", depth

    # ------------------------------------------------------------------- choose
    def choose(self, candidates: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Pick the next action: a chaos interaction on this page, or move to a new page."""
        cur = self.current
        if cur is None:
            return None

        can_move = bool(self.frontier) and len(self.visited) < self.max_pages
        budget = INTERACTIONS_PER_PAGE if can_move else INTERACTIONS_PER_PAGE * 3
        used = self.used.get(cur, 0)

        pool = [
            a for a in candidates
            if a.get("action_type") in _PRIORITY
            and (cur, a["action_type"], a.get("target_selector")) not in self.done
        ]
        if pool and used < budget:
            clicks = [a for a in pool if a["action_type"] == "click"]
            if used == budget - 1 and clicks:
                pool = clicks  # last slot on a page: press a button (submits what was filled in)
            best = min(_PRIORITY[a["action_type"]] for a in pool)
            pick = random.choice([a for a in pool if _PRIORITY[a["action_type"]] == best])
            self.done.add((cur, pick["action_type"], pick.get("target_selector")))
            self.used[cur] = used + 1
            return pick

        return self._next_page()

    def _next_page(self) -> Optional[Dict[str, Any]]:
        if not self.frontier or len(self.visited) >= self.max_pages:
            return None
        depth = min(d for _, d in self.frontier.values())  # breadth first
        key = random.choice([k for k, (_, d) in self.frontier.items() if d == depth])
        href, d = self.frontier.pop(key)
        self._arrival_depth = d
        return {"action_type": "navigate", "target_selector": None, "value": href}

    def back_action(self) -> Optional[Dict[str, Any]]:
        """Send the browser back to the last page on the site."""
        if self.last_onsite is None or self._offsite_returns >= MAX_OFFSITE_RETURNS:
            return None
        self._offsite_returns += 1
        self._arrival_depth = None
        return {"action_type": "navigate", "target_selector": None, "value": self.last_onsite}