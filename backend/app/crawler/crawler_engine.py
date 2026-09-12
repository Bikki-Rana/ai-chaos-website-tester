"""Web Crawler engine using BFS."""
import structlog
from urllib.parse import urlparse, urljoin
from collections import deque
from typing import AsyncGenerator, Tuple, Set

from app.browser.page_extractor import extract_page_info
from app.browser.models import PageInfo

logger = structlog.get_logger(__name__)


def is_same_domain(base_url: str, target_url: str) -> bool:
    """Check if target_url belongs to the same domain as base_url."""
    try:
        base_domain = urlparse(base_url).netloc
        target_domain = urlparse(target_url).netloc
        
        # Strip ports if we want to be strict about domains, but for local testing ports matter
        # For simplicity, exact netloc match
        return base_domain == target_domain
    except Exception:
        return False


async def crawl(
    start_url: str, 
    run_id: str, 
    max_pages: int = 10, 
    max_depth: int = 2,
    headless: bool = True,
    timeout_ms: int = 30000
) -> AsyncGenerator[Tuple[PageInfo, int], None]:
    """
    Crawls starting from start_url using BFS.
    Yields (PageInfo, depth) for each discovered page.
    """
    visited_urls: Set[str] = set()
    queue = deque([(start_url, 0)])
    pages_crawled = 0

    base_domain_url = start_url

    while queue and pages_crawled < max_pages:
        current_url, current_depth = queue.popleft()

        # Normalize URL (remove fragments)
        normalized_url = current_url.split('#')[0]
        
        if normalized_url in visited_urls:
            continue

        visited_urls.add(normalized_url)
        logger.info("crawling_page", url=normalized_url, depth=current_depth, count=pages_crawled+1)

        try:
            page_info = await extract_page_info(
                url=normalized_url,
                headless=headless,
                timeout_ms=timeout_ms,
                run_id=run_id
            )
            
            yield (page_info, current_depth)
            pages_crawled += 1

            # Discover new links if we haven't hit max depth
            if current_depth < max_depth:
                for link in page_info.links:
                    next_url = link.href
                    
                    if not next_url or next_url.startswith('javascript:'):
                        continue
                        
                    # Resolve relative URLs
                    if next_url.startswith('/'):
                        next_url = urljoin(normalized_url, next_url)
                        
                    next_normalized = next_url.split('#')[0]

                    if is_same_domain(base_domain_url, next_normalized) and next_normalized not in visited_urls:
                        # Avoid adding duplicates to the queue
                        if not any(item[0].split('#')[0] == next_normalized for item in queue):
                            queue.append((next_normalized, current_depth + 1))
                            
        except Exception as e:
            logger.error("crawl_page_failed", url=normalized_url, error=str(e))
            # Yield a stub page_info with the error so it can be recorded
            # Alternatively, we just skip it. Let's skip for simplicity, but the crawler shouldn't crash.
            pass

    logger.info("crawl_finished", total_pages=pages_crawled)