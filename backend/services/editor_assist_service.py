from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from core.agents.factory import AgentFactory

logger = logging.getLogger(__name__)

PROMPT_ID = "editor_assist_system"
PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "editor_assist" / "system.md"


class EditorAssistLLMResponse(BaseModel):
    summary: str = Field(..., description="Short explanation of the proposed change or explanation.")
    apply_to: Literal["selection", "full", "none"] = Field(
        ..., description="Where the proposed code should be applied."
    )
    replacement_text: Optional[str] = Field(
        default=None,
        description="Replacement code for the selected region or full file. Null when no code change is needed.",
    )


def load_editor_assist_prompt() -> str:
    if not PROMPT_PATH.exists():
        raise FileNotFoundError(
            f"Missing prompt asset for {PROMPT_ID}: expected file at {PROMPT_PATH}"
        )
    return PROMPT_PATH.read_text(encoding="utf-8")


async def run_editor_assist(
    *,
    agent_config: dict,
    instruction: str,
    code: str,
    selected_text: Optional[str],
    selection_start: Optional[int],
    selection_end: Optional[int],
) -> EditorAssistLLMResponse:
    llm = await AgentFactory._create_llm(
        agent_config.get("model", "gpt-4o"),
        agent_config.get("temperature", 0.7),
        agent_config.get("max_tokens"),
        {
            **agent_config,
            "streaming": False,
        },
    )

    system_prompt_template = load_editor_assist_prompt()
    system_prompt = system_prompt_template.format(
        agent_system_prompt=agent_config.get("system_prompt", "You are a helpful AI assistant."),
    )

    selection_payload = {
        "selected_text": selected_text or "",
        "selection_start": selection_start,
        "selection_end": selection_end,
        "has_selection": bool(selected_text),
    }

    user_payload = {
        "instruction": instruction,
        "code": code,
        "selection": selection_payload,
    }

    try:
        structured_llm = llm.with_structured_output(EditorAssistLLMResponse)
        result = await structured_llm.ainvoke(
            [
                SystemMessage(content=system_prompt),
                HumanMessage(content=str(user_payload)),
            ]
        )
        if isinstance(result, EditorAssistLLMResponse):
            return result
        return EditorAssistLLMResponse.model_validate(result)
    except Exception as exc:
        logger.error("Editor assist request failed", exc_info=True)
        raise ValueError(f"Editor assist failed: {exc}") from exc
