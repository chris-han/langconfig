# Copyright (c) 2025 Cade Russell (Ghost Peony)
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

"""State model for the journal entry workflow."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any, Optional, TypedDict
import operator


class JournalWorkflowStatus(str, Enum):
    """Execution status for a journal entry workflow."""

    INITIALIZED = "INITIALIZED"
    NEEDS_INPUT = "NEEDS_INPUT"
    ANALYZED = "ANALYZED"
    REVIEW_PENDING = "REVIEW_PENDING"
    STORED = "STORED"
    HISTORY_READY = "HISTORY_READY"
    FAILED = "FAILED"


class SentimentResult(TypedDict):
    """Simple sentiment analysis output."""

    label: str
    score: float
    emotions: list[str]
    confidence: float


class ThemeResult(TypedDict):
    """Theme extracted from a journal entry."""

    name: str
    category: str
    keywords: list[str]
    confidence: float


class ReflectionResult(TypedDict):
    """Reflection and coaching style output for the entry."""

    summary: str
    reflection_prompt: str
    suggested_tags: list[str]


class JournalEntryRecord(TypedDict):
    """Persistable journal entry record."""

    entry_id: str
    user_id: str
    entry_date: str
    content: str
    tags: list[str]
    sentiment: Optional[SentimentResult]
    themes: list[ThemeResult]
    reflection: Optional[ReflectionResult]
    created_at: str


class JournalHistoryRecord(TypedDict):
    """Historical entry used for summary workflows."""

    entry_date: str
    content: str
    tags: list[str]


class JournalEntryState(TypedDict):
    """Full LangGraph state for the journal workflow."""

    user_id: str
    entry_id: Optional[str]
    raw_entry: Optional[str]
    edited_entry: Optional[str]
    entry_date: Optional[str]
    tags: Annotated[list[str], operator.add]
    retrieve_history: bool
    historical_entries: Annotated[list[JournalHistoryRecord], operator.add]
    history_summary: Optional[str]
    review_required: bool
    approved: Optional[bool]
    review_notes: Optional[str]
    sentiment: Optional[SentimentResult]
    themes: Annotated[list[ThemeResult], operator.add]
    reflection: Optional[ReflectionResult]
    persisted_entry: Optional[JournalEntryRecord]
    status: JournalWorkflowStatus
    current_step: str
    error_message: Optional[str]
    created_at: str
    updated_at: str
    completed_at: Optional[str]
    processing_duration_seconds: Optional[float]
    step_history: Annotated[list[dict[str, Any]], operator.add]


def utc_now_iso() -> str:
    """Return an ISO-8601 timestamp in UTC."""

    return datetime.now(timezone.utc).isoformat()


def create_initial_state(
    *,
    user_id: str,
    raw_entry: Optional[str] = None,
    entry_date: Optional[str] = None,
    tags: Optional[list[str]] = None,
    retrieve_history: bool = False,
    historical_entries: Optional[list[JournalHistoryRecord]] = None,
    review_required: bool = True,
) -> JournalEntryState:
    """Create a new workflow state."""

    now = utc_now_iso()
    return JournalEntryState(
        user_id=user_id,
        entry_id=None,
        raw_entry=raw_entry,
        edited_entry=None,
        entry_date=entry_date,
        tags=list(tags or []),
        retrieve_history=retrieve_history,
        historical_entries=list(historical_entries or []),
        history_summary=None,
        review_required=review_required,
        approved=None,
        review_notes=None,
        sentiment=None,
        themes=[],
        reflection=None,
        persisted_entry=None,
        status=JournalWorkflowStatus.INITIALIZED,
        current_step="initialize",
        error_message=None,
        created_at=now,
        updated_at=now,
        completed_at=None,
        processing_duration_seconds=None,
        step_history=[],
    )
