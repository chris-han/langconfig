# Copyright (c) 2025 Cade Russell (Ghost Peony)
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

"""Node implementations for the journal entry workflow."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from .state import (
    JournalEntryRecord,
    JournalEntryState,
    JournalWorkflowStatus,
    ReflectionResult,
    SentimentResult,
    ThemeResult,
    utc_now_iso,
)


POSITIVE_WORDS = {
    "happy",
    "grateful",
    "excited",
    "calm",
    "joy",
    "good",
    "great",
    "hopeful",
    "energized",
}
NEGATIVE_WORDS = {
    "sad",
    "stressed",
    "anxious",
    "angry",
    "frustrated",
    "upset",
    "worried",
    "tired",
    "overwhelmed",
}
EMOTION_KEYWORDS = {
    "gratitude": {"grateful", "thankful"},
    "joy": {"happy", "joy", "excited"},
    "anxiety": {"anxious", "worried", "stress", "stressed"},
    "frustration": {"angry", "frustrated", "annoyed"},
    "fatigue": {"tired", "exhausted", "drained"},
}
THEME_KEYWORDS = {
    "work": {"work", "job", "career", "meeting", "deadline", "project"},
    "relationships": {"friend", "family", "partner", "relationship", "team"},
    "health": {"health", "sleep", "exercise", "energy", "body"},
    "money": {"money", "budget", "expense", "pay", "income"},
    "growth": {"learn", "goal", "habit", "improve", "growth"},
}


def _step(step: str, details: str) -> dict[str, Any]:
    return {"step": step, "details": details, "timestamp": utc_now_iso()}


def _duration_seconds(started_at: str) -> float:
    start = datetime.fromisoformat(started_at)
    return round((datetime.fromisoformat(utc_now_iso()) - start).total_seconds(), 3)


def initialize_entry(state: JournalEntryState) -> dict[str, Any]:
    """Initialize the workflow and assign an entry id for new entries."""

    updates: dict[str, Any] = {
        "updated_at": utc_now_iso(),
        "step_history": [_step("initialize", "Initialized journal entry workflow.")],
    }
    if not state.get("retrieve_history"):
        updates["entry_id"] = state.get("entry_id") or str(uuid4())
    return updates


def validate_entry(state: JournalEntryState) -> dict[str, Any]:
    """Validate that an entry exists before analysis begins."""

    entry = (state.get("edited_entry") or state.get("raw_entry") or "").strip()
    if not entry:
        now = utc_now_iso()
        return {
            "status": JournalWorkflowStatus.NEEDS_INPUT,
            "current_step": "await_entry",
            "error_message": "A journal entry is required before analysis can begin.",
            "updated_at": now,
            "step_history": [_step("validate_entry", "No journal entry text was provided.")],
        }

    if len(entry) < 15:
        now = utc_now_iso()
        return {
            "status": JournalWorkflowStatus.FAILED,
            "current_step": "validate_entry",
            "error_message": "Journal entry text is too short for meaningful analysis.",
            "updated_at": now,
            "completed_at": now,
            "processing_duration_seconds": _duration_seconds(state["created_at"]),
            "step_history": [_step("validate_entry", "Entry failed minimum-length validation.")],
        }

    return {
        "updated_at": utc_now_iso(),
        "step_history": [_step("validate_entry", "Entry validated successfully.")],
    }


def analyze_sentiment(state: JournalEntryState) -> dict[str, Any]:
    """Analyze sentiment using lightweight keyword heuristics."""

    text = (state.get("edited_entry") or state.get("raw_entry") or "").lower()
    tokens = {token.strip(".,!?;:()[]\"'") for token in text.split()}
    positive_hits = len(tokens & POSITIVE_WORDS)
    negative_hits = len(tokens & NEGATIVE_WORDS)

    if positive_hits == negative_hits:
        label = "neutral"
        score = 0.0
    elif positive_hits > negative_hits:
        label = "positive"
        score = round(min(1.0, (positive_hits - negative_hits) / 4), 2)
    else:
        label = "negative"
        score = round(max(-1.0, -(negative_hits - positive_hits) / 4), 2)

    emotions = [
        name for name, keywords in EMOTION_KEYWORDS.items() if tokens & keywords
    ] or ["neutral"]

    sentiment: SentimentResult = {
        "label": label,
        "score": score,
        "emotions": emotions,
        "confidence": 0.6 if emotions == ["neutral"] else 0.8,
    }

    return {
        "sentiment": sentiment,
        "status": JournalWorkflowStatus.ANALYZED,
        "current_step": "analyze_sentiment",
        "updated_at": utc_now_iso(),
        "step_history": [_step("analyze_sentiment", f"Detected {label} sentiment.")],
    }


def extract_themes(state: JournalEntryState) -> dict[str, Any]:
    """Extract themes from the entry."""

    text = (state.get("edited_entry") or state.get("raw_entry") or "").lower()
    tokens = {token.strip(".,!?;:()[]\"'") for token in text.split()}
    themes: list[ThemeResult] = []

    for category, keywords in THEME_KEYWORDS.items():
        matches = sorted(tokens & keywords)
        if not matches:
            continue
        themes.append(
            ThemeResult(
                name=category.title(),
                category=category,
                keywords=matches[:4],
                confidence=round(min(0.95, 0.45 + (0.1 * len(matches))), 2),
            )
        )

    if not themes:
        themes.append(
            ThemeResult(
                name="General Reflection",
                category="general",
                keywords=["reflection"],
                confidence=0.5,
            )
        )

    return {
        "themes": themes,
        "updated_at": utc_now_iso(),
        "current_step": "extract_themes",
        "step_history": [_step("extract_themes", f"Extracted {len(themes)} theme(s).")],
    }


def generate_reflection(state: JournalEntryState) -> dict[str, Any]:
    """Generate a deterministic reflection package."""

    sentiment = state.get("sentiment")
    themes = state.get("themes", [])
    top_themes = [theme["name"] for theme in themes[:3]]
    suggested_tags = sorted(set(state.get("tags", []) + [theme["category"] for theme in themes[:3]]))

    summary = "Entry analyzed successfully."
    reflection_prompt = "What felt most important about today?"
    if sentiment:
        if sentiment["label"] == "positive":
            summary = "The entry carries positive energy and constructive momentum."
            reflection_prompt = "Which conditions helped this day go well, and how can you recreate them?"
        elif sentiment["label"] == "negative":
            summary = "The entry contains strain or unresolved pressure points."
            reflection_prompt = "What would reduce the pressure you described by one concrete step tomorrow?"
        else:
            summary = "The entry reads as balanced and reflective."
            reflection_prompt = "What detail from today deserves more attention than you first gave it?"

    if top_themes:
        summary = f"{summary} Main themes: {', '.join(top_themes)}."

    reflection: ReflectionResult = {
        "summary": summary,
        "reflection_prompt": reflection_prompt,
        "suggested_tags": suggested_tags,
    }

    return {
        "reflection": reflection,
        "current_step": "generate_reflection",
        "updated_at": utc_now_iso(),
        "step_history": [_step("generate_reflection", "Generated reflection summary and follow-up prompt.")],
    }


def await_review(state: JournalEntryState) -> dict[str, Any]:
    """Pause the workflow in a review-pending state."""

    return {
        "status": JournalWorkflowStatus.REVIEW_PENDING,
        "current_step": "await_review",
        "updated_at": utc_now_iso(),
        "step_history": [_step("await_review", "Entry is ready for human review before storage.")],
    }


def store_entry(state: JournalEntryState) -> dict[str, Any]:
    """Store the finalized entry into a persistable record."""

    now = utc_now_iso()
    final_text = (state.get("edited_entry") or state.get("raw_entry") or "").strip()
    reflection = state.get("reflection")
    final_tags = sorted(set(state.get("tags", []) + (reflection["suggested_tags"] if reflection else [])))

    record: JournalEntryRecord = {
        "entry_id": state.get("entry_id") or str(uuid4()),
        "user_id": state["user_id"],
        "entry_date": state.get("entry_date") or now[:10],
        "content": final_text,
        "tags": final_tags,
        "sentiment": state.get("sentiment"),
        "themes": list(state.get("themes", [])),
        "reflection": reflection,
        "created_at": now,
    }

    return {
        "persisted_entry": record,
        "tags": final_tags,
        "status": JournalWorkflowStatus.STORED,
        "current_step": "store_entry",
        "updated_at": now,
        "completed_at": now,
        "processing_duration_seconds": _duration_seconds(state["created_at"]),
        "step_history": [_step("store_entry", "Prepared final journal entry record for persistence.")],
    }


def summarize_history(state: JournalEntryState) -> dict[str, Any]:
    """Summarize a supplied list of historical entries."""

    entries = state.get("historical_entries", [])
    now = utc_now_iso()
    if not entries:
        summary = "No historical journal entries were supplied for summarization."
    else:
        tag_counts: dict[str, int] = {}
        for entry in entries:
            for tag in entry.get("tags", []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        top_tags = ", ".join(
            tag for tag, _count in sorted(tag_counts.items(), key=lambda item: (-item[1], item[0]))[:3]
        ) or "no recurring tags"
        summary = (
            f"Reviewed {len(entries)} historical entr"
            f"{'y' if len(entries) == 1 else 'ies'}; recurring tags: {top_tags}."
        )

    return {
        "history_summary": summary,
        "status": JournalWorkflowStatus.HISTORY_READY,
        "current_step": "summarize_history",
        "updated_at": now,
        "completed_at": now,
        "processing_duration_seconds": _duration_seconds(state["created_at"]),
        "step_history": [_step("summarize_history", "Built history summary from supplied entries.")],
    }
