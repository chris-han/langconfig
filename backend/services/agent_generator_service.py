# Copyright (c) 2025 Cade Russell (Ghost Peony)
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

"""
Simple AI-powered agent configuration generator for v1 alpha.
Uses the configured LangConfig model factory so generation can run on any supported provider.
"""
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, SystemMessage
import logging

from core.agents.factory import AgentFactory

logger = logging.getLogger(__name__)

PROMPT_ID = "agent_generator_system"
PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "agent_generator" / "system.md"
GENERIC_DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful AI assistant with planning, research, and task delegation capabilities. "
    "When facing complex multi-step tasks, use the `task` tool to delegate specialized work to subagents."
)


class GenerateAgentRequest(BaseModel):
    """Request model for agent generation"""
    name: str
    description: str
    agent_type: str  # "regular" or "deep"
    category: Optional[str] = None
    model: Optional[str] = None


class GeneratedAgentConfig(BaseModel):
    """Generated agent configuration"""
    model: str
    temperature: float
    system_prompt: str
    mcp_tools: list[str]
    reasoning: str
    confidence_score: float = 0.8


def infer_runtime_model(request: GenerateAgentRequest, generation_model: str) -> str:
    description = request.description.lower()
    category = (request.category or "").lower()

    if "research" in category or "research" in description:
        return "gpt-4o"
    if "test" in category or "test" in description:
        return generation_model
    if "code" in category or "python" in description or "langgraph" in description:
        return generation_model
    return generation_model


def infer_temperature(request: GenerateAgentRequest) -> float:
    description = request.description.lower()
    category = (request.category or "").lower()

    if "code" in category or "python" in description or "test" in category:
        return 0.2
    if "research" in category or "research" in description:
        return 0.4
    return 0.5


def infer_tools(request: GenerateAgentRequest) -> list[str]:
    description = request.description.lower()
    category = (request.category or "").lower()
    tools: list[str] = []

    if "code" in category or "python" in description or "langgraph" in description:
        tools.extend(["read_file", "write_file", "ls", "edit_file", "glob", "grep"])

    if "research" in category or "research" in description:
        tools.extend(["web_search", "web_fetch"])

    if request.agent_type == "deep":
        tools.extend(["reasoning_chain", "memory_store", "memory_recall"])

    deduped_tools: list[str] = []
    for tool in tools:
        if tool not in deduped_tools:
            deduped_tools.append(tool)

    return deduped_tools or ["read_file", "ls"]


def build_fallback_config(
    request: GenerateAgentRequest,
    generation_model: str,
    reason: str,
) -> GeneratedAgentConfig:
    return GeneratedAgentConfig(
        model=infer_runtime_model(request, generation_model),
        temperature=infer_temperature(request),
        system_prompt=build_specific_system_prompt(request),
        mcp_tools=infer_tools(request),
        reasoning=(
            "LangConfig applied a deterministic fallback configuration because the model response could not be "
            f"parsed reliably. Reason: {reason}"
        ),
        confidence_score=0.6,
    )


def build_specific_system_prompt(request: GenerateAgentRequest) -> str:
    role_line = (
        f"You are {request.name}, a {request.category or 'custom'} {request.agent_type} agent."
        if request.name
        else f"You are a {request.category or 'custom'} {request.agent_type} agent."
    )
    task_shape = (
        "Handle focused single-agent execution, use tools deliberately, and return concise, dependable results."
        if request.agent_type == "regular"
        else "Handle complex multi-step work, break tasks into clear stages, and use deeper planning before acting."
    )

    return (
        f"{role_line} Your primary responsibility is: {request.description.strip()}.\n\n"
        f"{task_shape} Use only the tools that materially help with the task, explain assumptions when needed, "
        f"and keep outputs aligned with the user's requested outcome.\n\n"
        "When writing or changing code, prefer precise, minimal edits and call out tradeoffs or risks that would "
        "affect implementation quality."
    )


async def generate_agent_config(request: GenerateAgentRequest) -> dict:
    """
    Generate agent configuration using OpenAI GPT-4o.

    Args:
        request: Generation request with name, description, agent_type

    Returns:
        Generated agent configuration as dict
    """
    # Available options
    available_models = [
        "gpt-4o",
        "gpt-4o-mini",
        "claude-sonnet-4-5-20250929",
        "claude-haiku-4-5",
        "gemini-2.0-flash-exp"
    ]

    # DeepAgents standard filesystem tool names
    available_tools = [
        "read_file",
        "write_file",
        "ls",
        "edit_file",
        "glob",
        "grep",
        "web_search",
        "web_fetch",
        "browser",
        "reasoning_chain",
        "memory_store",
        "memory_recall"
    ]

    if not PROMPT_PATH.exists():
        raise ValueError(f"Missing prompt asset for {PROMPT_ID}: expected file at {PROMPT_PATH}")

    system_prompt = PROMPT_PATH.read_text(encoding="utf-8")
    generation_model = request.model or "gpt-4o"
    user_payload = {
        "name": request.name,
        "description": request.description,
        "agent_type": request.agent_type,
        "category": request.category or "Not specified",
        "selected_generation_model": generation_model,
        "available_models": available_models,
        "available_tools": available_tools,
    }

    try:
        logger.info(f"Generating agent config for: {request.name} using model {generation_model}")
        llm = await AgentFactory._create_llm(
            generation_model,
            0.3,
            3000,
            {"streaming": False},
        )
        structured_llm = llm.with_structured_output(GeneratedAgentConfig, include_raw=True)
        generated_response = await structured_llm.ainvoke(
            [
                SystemMessage(content=system_prompt),
                HumanMessage(content=str(user_payload)),
            ]
        )

        parsed_config = (
            generated_response.get("parsed")
            if isinstance(generated_response, dict)
            else generated_response
        )
        parsing_error = (
            generated_response.get("parsing_error")
            if isinstance(generated_response, dict)
            else None
        )

        if parsing_error or parsed_config is None:
            logger.warning(
                "Agent generation returned unparsable structured output for %s; applying deterministic fallback: %s",
                request.name,
                parsing_error or "missing parsed payload",
            )
            return build_fallback_config(
                request,
                generation_model,
                str(parsing_error or "missing parsed payload"),
            ).model_dump()

        validated_config = (
            parsed_config
            if isinstance(parsed_config, GeneratedAgentConfig)
            else GeneratedAgentConfig.model_validate(parsed_config)
        )

        if not validated_config.model.strip():
            validated_config = validated_config.model_copy(update={"model": infer_runtime_model(request, generation_model)})

        if not validated_config.mcp_tools:
            validated_config = validated_config.model_copy(update={"mcp_tools": infer_tools(request)})

        if (
            not validated_config.system_prompt.strip()
            or validated_config.system_prompt.strip() == GENERIC_DEFAULT_SYSTEM_PROMPT
        ):
            logger.warning(
                "Agent generation returned a generic system prompt for %s; applying deterministic fallback",
                request.name,
            )
            validated_config = validated_config.model_copy(
                update={
                    "system_prompt": build_specific_system_prompt(request),
                    "reasoning": (
                        f"{validated_config.reasoning} "
                        "The returned system prompt was too generic, so LangConfig replaced it with a prompt tailored "
                        "to the provided name and description."
                    ).strip(),
                }
            )

        return validated_config.model_dump()
    except Exception as e:
        logger.error(f"Agent generation failed: {e}")
        raise ValueError(f"Agent generation failed: {str(e)}")
