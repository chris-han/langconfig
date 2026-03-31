from orchestration.journal_entry import (
    JournalEntryWorkflowRunner,
    JournalWorkflowStatus,
)


def test_journal_entry_workflow_completes_without_review():
    runner = JournalEntryWorkflowRunner()

    result = runner.run_entry(
        user_id="user-1",
        raw_entry="I felt grateful after finishing a hard work project and had more energy than usual.",
        tags=["daily"],
        review_required=False,
    )

    assert result["status"] == JournalWorkflowStatus.STORED
    assert result["persisted_entry"] is not None
    assert result["reflection"] is not None
    assert result["processing_duration_seconds"] is not None


def test_journal_entry_workflow_pauses_for_review_when_requested():
    runner = JournalEntryWorkflowRunner()

    result = runner.run_entry(
        user_id="user-2",
        raw_entry="I am stressed about work and worried about tomorrow's deadline.",
        review_required=True,
    )

    assert result["status"] == JournalWorkflowStatus.REVIEW_PENDING
    assert result["persisted_entry"] is None
    assert result["reflection"] is not None


def test_journal_entry_history_summary_mode():
    runner = JournalEntryWorkflowRunner()

    result = runner.summarize_history(
        user_id="user-3",
        entries=[
            {"entry_date": "2026-03-29", "content": "Worked on taxes.", "tags": ["work", "money"]},
            {"entry_date": "2026-03-30", "content": "Went for a run.", "tags": ["health"]},
            {"entry_date": "2026-03-31", "content": "Met with family.", "tags": ["relationships"]},
        ],
    )

    assert result["status"] == JournalWorkflowStatus.HISTORY_READY
    assert "Reviewed 3 historical entries" in result["history_summary"]
