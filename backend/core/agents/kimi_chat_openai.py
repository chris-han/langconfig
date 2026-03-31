"""Kimi-compatible ChatOpenAI wrapper.

`langchain_openai.ChatOpenAI` intentionally drops non-standard provider fields
such as `reasoning_content`. Kimi requires that field to be replayed on
assistant tool-call messages when reasoning is enabled, so we preserve and
re-emit it here.
"""

from __future__ import annotations

from typing import Any

import openai
from langchain_core.messages import AIMessage, AIMessageChunk
from langchain_core.outputs import ChatGenerationChunk, ChatResult
from langchain_openai import ChatOpenAI
from langchain_openai.chat_models._compat import _convert_from_v1_to_chat_completions
from langchain_openai.chat_models.base import _convert_message_to_dict


def _extract_reasoning_content(message: AIMessage) -> str | None:
    """Read provider-specific reasoning content from message metadata."""
    for source in (message.additional_kwargs, message.response_metadata):
        if not isinstance(source, dict):
            continue
        value = source.get("reasoning_content")
        if isinstance(value, str):
            return value
    return None


def _convert_message_to_dict_with_reasoning(message: Any) -> dict[str, Any]:
    """Convert a message to an OpenAI-style dict while preserving Kimi fields."""
    payload = _convert_message_to_dict(message)

    if not isinstance(message, AIMessage):
        return payload

    reasoning_content = _extract_reasoning_content(message)
    if reasoning_content is not None:
        payload["reasoning_content"] = reasoning_content
    elif payload.get("tool_calls"):
        # Kimi validates presence, not semantic richness, on replayed assistant
        # tool-call turns when reasoning mode is enabled.
        payload["reasoning_content"] = ""

    return payload


def _ensure_reasoning_content_on_payload_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Backfill Kimi reasoning metadata on assistant tool-call replay payloads.

    Some middleware paths reshape assistant tool-call turns before they reach the
    model transport layer. At that point the original `AIMessage` metadata may
    already be gone, so enforce Kimi's required field on the final payload too.
    """
    normalized_messages: list[dict[str, Any]] = []

    for message in messages:
        normalized = dict(message)
        if (
            normalized.get("role") == "assistant"
            and normalized.get("tool_calls")
            and "reasoning_content" not in normalized
        ):
            normalized["reasoning_content"] = ""
        normalized_messages.append(normalized)

    return normalized_messages


class KimiChatOpenAI(ChatOpenAI):
    """ChatOpenAI variant that preserves Kimi `reasoning_content`."""

    def _get_request_payload(
        self,
        input_: Any,
        *,
        stop: list[str] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        payload = super()._get_request_payload(input_, stop=stop, **kwargs)

        if "messages" not in payload:
            return payload

        messages = self._convert_input(input_).to_messages()
        payload["messages"] = _ensure_reasoning_content_on_payload_messages([
            _convert_message_to_dict_with_reasoning(
                _convert_from_v1_to_chat_completions(message)
                if isinstance(message, AIMessage)
                else message
            )
            for message in messages
        ])
        return payload

    def _create_chat_result(
        self,
        response: dict | openai.BaseModel,
        generation_info: dict | None = None,
    ) -> ChatResult:
        result = super()._create_chat_result(response, generation_info)
        response_dict = response if isinstance(response, dict) else response.model_dump()

        for generation, choice in zip(result.generations, response_dict.get("choices", [])):
            message = generation.message
            if not isinstance(message, AIMessage):
                continue
            reasoning_content = (choice.get("message") or {}).get("reasoning_content")
            if isinstance(reasoning_content, str):
                message.additional_kwargs["reasoning_content"] = reasoning_content
                message.response_metadata["reasoning_content"] = reasoning_content

        return result

    def _convert_chunk_to_generation_chunk(
        self,
        chunk: dict[str, Any],
        default_chunk_class: type,
        base_generation_info: dict[str, Any] | None,
    ) -> ChatGenerationChunk | None:
        generation_chunk = super()._convert_chunk_to_generation_chunk(
            chunk,
            default_chunk_class,
            base_generation_info,
        )
        if generation_chunk is None:
            return None

        choices = chunk.get("choices", []) or chunk.get("chunk", {}).get("choices", [])
        if not choices:
            return generation_chunk

        delta = choices[0].get("delta") or {}
        reasoning_content = delta.get("reasoning_content")
        message = generation_chunk.message

        if isinstance(reasoning_content, str) and isinstance(message, AIMessageChunk):
            existing = message.additional_kwargs.get("reasoning_content", "")
            message.additional_kwargs["reasoning_content"] = f"{existing}{reasoning_content}"
            message.response_metadata["reasoning_content"] = message.additional_kwargs["reasoning_content"]

        return generation_chunk
