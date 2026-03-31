# Copyright (c) 2025 Cade Russell (Ghost Peony)
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

"""Convenience runner for the journal entry workflow."""

from __future__ import annotations

from typing import Optional

from .graph import create_journal_entry_graph
from .state import JournalEntryState, JournalHistoryRecord, create_initial_state


class JournalEntryWorkflowRunner:
    """High-level entry point for journal entry workflows."""

    def __init__(self) -> None:
        self.graph = create_journal_entry_graph()

    def run_entry(
        self,
        *,
        user_id: str,
        raw_entry: str,
        entry_date: Optional[str] = None,
        tags: Optional[list[str]] = None,
        review_required: bool = True,
    ) -> JournalEntryState:
        """Run a new journal entry through the workflow."""

        initial_state = create_initial_state(
            user_id=user_id,
            raw_entry=raw_entry,
            entry_date=entry_date,
            tags=tags,
            review_required=review_required,
        )
        return self.graph.invoke(initial_state)

    def summarize_history(
        self,
        *,
        user_id: str,
        entries: list[JournalHistoryRecord],
    ) -> JournalEntryState:
        """Summarize a supplied set of historical journal entries."""

        initial_state = create_initial_state(
            user_id=user_id,
            retrieve_history=True,
            historical_entries=entries,
            review_required=False,
        )
        return self.graph.invoke(initial_state)
