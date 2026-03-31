from services import coding_agent_prompt_assets as prompt_assets


def test_load_coding_agent_system_prompt_contains_planning_modes():
    prompt = prompt_assets.load_coding_agent_system_prompt()

    assert "Planning Modes" in prompt
    assert "`brief`" in prompt
    assert "`standard`" in prompt
    assert "`deep`" in prompt


def test_load_coding_agent_eval_rubric_contains_post_write_closure_dimension():
    rubric = prompt_assets.load_coding_agent_eval_rubric()

    assert "Post-Write Closure" in rubric
    assert "Keeps exploring after writing the requested files." in rubric


def test_load_coding_agent_prompt_asset_raises_when_missing(monkeypatch, tmp_path):
    missing_prompt = tmp_path / "missing_system.md"
    monkeypatch.setattr(prompt_assets, "CODING_AGENT_SYSTEM_PROMPT_PATH", missing_prompt)

    try:
        prompt_assets.load_coding_agent_system_prompt()
    except FileNotFoundError as exc:
        assert "Missing prompt asset for coding_agent_system" in str(exc)
    else:
        raise AssertionError("Expected FileNotFoundError for missing coding agent prompt asset")
