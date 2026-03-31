# Copyright (c) 2025 Cade Russell (Ghost Peony)
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

"""LangGraph topology for the journal entry workflow."""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from .nodes import (
    analyze_sentiment,
    await_review,
    extract_themes,
    generate_reflection,
    initialize_entry,
    store_entry,
    summarize_history,
    validate_entry,
)
from .state import JournalEntryState, JournalWorkflowStatus


def _route_after_initialize(
    state: JournalEntryState,
) -> Literal["summarize_history", "validate_entry"]:
    return "summarize_history" if state.get("retrieve_history") else "validate_entry"


def _route_after_validation(
    state: JournalEntryState,
) -> Literal["analyze_sentiment", END]:
    status = state.get("status")
    if status in {JournalWorkflowStatus.FAILED, JournalWorkflowStatus.NEEDS_INPUT}:
        return END
    return "analyze_sentiment"


def _route_after_reflection(
    state: JournalEntryState,
) -> Literal["await_review", "store_entry"]:
    return "await_review" if state.get("review_required", True) else "store_entry"


def create_journal_entry_graph():
    """Create and compile the journal entry workflow."""

    graph = StateGraph(JournalEntryState)

    graph.add_node("initialize_entry", initialize_entry)
    graph.add_node("validate_entry", validate_entry)
    graph.add_node("analyze_sentiment", analyze_sentiment)
    graph.add_node("extract_themes", extract_themes)
    graph.add_node("generate_reflection", generate_reflection)
    graph.add_node("await_review", await_review)
    graph.add_node("store_entry", store_entry)
    graph.add_node("summarize_history", summarize_history)

    graph.add_edge(START, "initialize_entry")
    graph.add_conditional_edges(
        "initialize_entry",
        _route_after_initialize,
        {
            "summarize_history": "summarize_history",
            "validate_entry": "validate_entry",
        },
    )
    graph.add_conditional_edges(
        "validate_entry",
        _route_after_validation,
        {
            "analyze_sentiment": "analyze_sentiment",
            END: END,
        },
    )
    graph.add_edge("analyze_sentiment", "extract_themes")
    graph.add_edge("extract_themes", "generate_reflection")
    graph.add_conditional_edges(
        "generate_reflection",
        _route_after_reflection,
        {
            "await_review": "await_review",
            "store_entry": "store_entry",
        },
    )
    graph.add_edge("await_review", END)
    graph.add_edge("store_entry", END)
    graph.add_edge("summarize_history", END)

    return graph.compile()
