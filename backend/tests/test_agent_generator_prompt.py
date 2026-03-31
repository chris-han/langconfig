from pathlib import Path

from services.agent_generator_service import PROMPT_PATH


def test_agent_generator_meta_prompt_requires_coding_agent_operating_contract():
    prompt = Path(PROMPT_PATH).read_text(encoding="utf-8")

    assert "planning-depth policy with `brief`, `standard`, and `deep`" in prompt
    assert "minimal-runnable-slice rule" in prompt
    assert "explicit stop / closure rules after the deliverable exists" in prompt
    assert "anti-pattern avoidance for runaway post-write exploration" in prompt
    assert "Desired prompt structure for coding-oriented agents" in prompt
