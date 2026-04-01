"""Regression tests for file storage path handling."""

from pathlib import Path

from services.file_storage import FileStorage


def test_save_file_supports_nested_storage_key(tmp_path: Path) -> None:
    storage = FileStorage(base_dir=str(tmp_path / "documents"))

    saved_path = storage.save_file("chat_sessions/session-123", "note.txt", b"hello")

    saved = Path(saved_path)
    assert saved.exists()
    assert saved.read_bytes() == b"hello"
    assert "project_chat_sessions" in saved_path
    assert "session-123" in saved_path
