import pytest
from app.crawler.crawler_engine import is_same_domain

def test_is_same_domain():
    assert is_same_domain("http://localhost:5000", "http://localhost:5000/products")
    assert is_same_domain("https://example.com", "https://example.com/about")
    assert not is_same_domain("http://localhost:5000", "http://google.com")
    assert not is_same_domain("https://example.com", "https://sub.example.com") # strict match