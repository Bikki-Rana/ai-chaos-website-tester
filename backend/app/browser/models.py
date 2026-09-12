"""Data models for browser automation results.

All models are plain dataclasses (no ORM dependency) so this module
can be imported and tested without a database connection.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ElementInfo:
    """Represents a single interactive element found on a page."""

    tag: str
    """HTML tag name, e.g. 'button', 'a', 'input'."""

    selector: str
    """Best CSS/XPath selector to locate this element."""

    text: str = ""
    """Visible text content of the element."""

    element_type: Optional[str] = None
    """input[@type] value where applicable."""

    href: Optional[str] = None
    """href attribute for anchor elements."""

    name: Optional[str] = None
    """name attribute."""

    placeholder: Optional[str] = None
    """placeholder attribute for input/textarea."""

    value: Optional[str] = None
    """Current value for inputs/selects."""

    is_visible: bool = True
    """Whether the element was visible at extraction time."""

    aria_label: Optional[str] = None
    """aria-label attribute, useful for accessibility-labeled controls."""


@dataclass
class FormInfo:
    """Represents a complete HTML form."""

    selector: str
    action: Optional[str] = None
    method: str = "get"
    fields: list = field(default_factory=list)  # list[ElementInfo]
    submit_button: Optional[ElementInfo] = None


@dataclass
class ConsoleMessage:
    """A message emitted to the browser console."""

    level: str  # 'log', 'info', 'warning', 'error'
    text: str
    timestamp_ms: float
    location: Optional[str] = None


@dataclass
class NetworkEvent:
    """A network request/response pair captured during page load."""

    url: str
    method: str
    resource_type: str
    status: Optional[int] = None
    # True = request, False = response
    is_request: bool = True
    request_headers: dict = field(default_factory=dict)
    response_headers: dict = field(default_factory=dict)
    duration_ms: Optional[float] = None
    failed: bool = False
    failure_reason: Optional[str] = None


@dataclass
class PageInfo:
    """Complete snapshot of a page extracted by the browser automation engine."""

    run_id: str
    """Unique identifier for this extraction run."""

    url: str
    """URL that was requested."""

    final_url: str
    """Actual URL after any redirects."""

    title: str
    """Page title."""

    buttons: list = field(default_factory=list)    # list[ElementInfo]
    links: list = field(default_factory=list)       # list[ElementInfo]
    inputs: list = field(default_factory=list)      # list[ElementInfo]
    forms: list = field(default_factory=list)       # list[FormInfo]
    selects: list = field(default_factory=list)     # list[ElementInfo]
    textareas: list = field(default_factory=list)   # list[ElementInfo]

    console_messages: list = field(default_factory=list)   # list[ConsoleMessage]
    network_events: list = field(default_factory=list)     # list[NetworkEvent]

    screenshot_path: Optional[str] = None
    action_log_path: Optional[str] = None

    duration_ms: float = 0.0
    timestamp: str = ""
    errors: list = field(default_factory=list)  # list[str]
