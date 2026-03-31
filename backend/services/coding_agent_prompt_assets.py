from __future__ import annotations

from pathlib import Path

CODING_AGENT_SYSTEM_PROMPT_ID = "coding_agent_system"
CODING_AGENT_EVAL_RUBRIC_ID = "coding_agent_eval_rubric"

_PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts" / "coding_agent"
CODING_AGENT_SYSTEM_PROMPT_PATH = _PROMPTS_DIR / "system.md"
CODING_AGENT_EVAL_RUBRIC_PATH = _PROMPTS_DIR / "eval_rubric.md"


def _load_prompt_asset(prompt_id: str, prompt_path: Path) -> str:
    if not prompt_path.exists():
        raise FileNotFoundError(
            f"Missing prompt asset for {prompt_id}: expected file at {prompt_path}"
        )
    return prompt_path.read_text(encoding="utf-8")


def load_coding_agent_system_prompt() -> str:
    return _load_prompt_asset(CODING_AGENT_SYSTEM_PROMPT_ID, CODING_AGENT_SYSTEM_PROMPT_PATH)


def load_coding_agent_eval_rubric() -> str:
    return _load_prompt_asset(CODING_AGENT_EVAL_RUBRIC_ID, CODING_AGENT_EVAL_RUBRIC_PATH)
