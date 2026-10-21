"""Simulated site tests for the crawl policy (no browser needed)."""
import random

from app.agent.crawl_policy import INTERACTIONS_PER_PAGE, CrawlPolicy, normalize_url

ROOT = "https://shop.test"

SITE = {
    "/":      {"links": ["/a", "/b/", "/c#top", "https://other.example/x", "mailto:hi@shop.test", "/file.pdf", "#top"],
               "buttons": ["#b1", "#b2", "#b3"], "inputs": ["#q"]},
    "/a":     {"links": ["/", "/a1", "/a2"], "buttons": ["#b1"], "inputs": []},
    "/b":     {"links": ["/", "/b1"], "buttons": ["#b1", "#ext"], "inputs": ["#email", "#pw"]},
    "/c":     {"links": ["/"], "buttons": [], "inputs": []},
    "/a1":    {"links": ["/a", "/a11"], "buttons": ["#b1"], "inputs": []},
    "/a2":    {"links": ["/a"], "buttons": [], "inputs": []},
    "/b1":    {"links": ["/b"], "buttons": ["#b1"], "inputs": []},
    "/a11":   {"links": ["/a1"], "buttons": ["#b1"], "inputs": []},
}


def page_key(url: str) -> str:
    return normalize_url(url).replace("shop.test", "").replace("https://", "") or "/"


def candidates(url: str):
    page = SITE.get(page_key(url), {"links": [], "buttons": [], "inputs": []})
    out = [{"action_type": "click", "target_selector": b, "value": "x"} for b in page["buttons"]]
    out += [{"action_type": "fill", "target_selector": i, "value": "chaos_test_123"} for i in page["inputs"]]
    out += [{"action_type": "navigate", "target_selector": "a", "value": h} for h in page["links"]]
    return out


def simulate(max_pages: int, max_depth: int, seed: int = 0):
    random.seed(seed)
    pol = CrawlPolicy(ROOT, max_pages, max_depth)
    url = ROOT + "/"
    steps, off_site_seen, actions = 0, False, []
    while steps < 500:
        links = [ROOT + h if h.startswith("/") else h for h in SITE.get(page_key(url), {"links": []})["links"]]
        verdict, _ = pol.observe(url, links)
        if verdict == "limit":
            break
        act = pol.back_action() if verdict != "ok" else pol.choose(candidates(url))
        if act is None:
            break
        steps += 1
        actions.append(act)
        if act["action_type"] == "navigate":
            url = act["value"] if act["value"].startswith("http") else ROOT + act["value"]
        elif act["action_type"] == "click" and act["target_selector"] == "#ext":
            url = "https://other.example/landing"  # a button that leaves the site
            off_site_seen = True
    return pol, steps, actions, off_site_seen


def test_limits_are_respected():
    for seed in range(40):
        for max_pages, max_depth in [(1, 0), (3, 1), (5, 2), (10, 3), (4, 5)]:
            pol, steps, _, _ = simulate(max_pages, max_depth, seed)
            assert len(pol.visited) <= max_pages
            assert max(pol.visited.values()) <= max_depth
            assert steps < 500


def test_it_actually_crawls_even_when_pages_have_buttons():
    pol, _, actions, _ = simulate(6, 3, seed=1)
    assert len(pol.visited) == 6
    assert sum(1 for a in actions if a["action_type"] == "navigate") >= 5


def test_every_page_gets_a_limited_number_of_interactions():
    pol, _, _, _ = simulate(8, 3, seed=2)
    assert max(pol.used.values()) <= INTERACTIONS_PER_PAGE * 3


def test_depth_zero_stays_on_the_start_page():
    pol, _, actions, _ = simulate(10, 0, seed=3)
    assert list(pol.visited) == [normalize_url(ROOT + "/")]
    assert not any(a["action_type"] == "navigate" for a in actions)


def test_never_follows_external_mailto_or_files():
    pol, _, actions, _ = simulate(10, 3, seed=4)
    targets = [a["value"] for a in actions if a["action_type"] == "navigate"]
    assert not any("other.example" in t or t.startswith("mailto:") or t.endswith(".pdf") for t in targets)


def test_leaving_the_site_by_click_sends_the_bot_back():
    saw = False
    for seed in range(60):
        pol, _, _, off = simulate(6, 2, seed)
        if off:
            saw = True
            assert not any("other.example" in k for k in pol.visited)
    assert saw  # the scenario happened at least once


def test_actions_are_not_repeated_on_a_page():
    pol, _, actions, _ = simulate(1, 0, seed=5)
    keys = [(a["action_type"], a["target_selector"]) for a in actions]
    assert len(keys) == len(set(keys))


def test_start_url_redirect_is_accepted():
    pol = CrawlPolicy("http://shop.test", 3, 2)
    verdict, depth = pol.observe("https://www.shop.test/home", [])
    assert verdict == "ok" and depth == 0