from langchain_core.messages import AIMessage

from core.agents.kimi_chat_openai import _convert_message_to_dict_with_reasoning


def test_convert_message_to_dict_preserves_reasoning_content():
    message = AIMessage(
        content="",
        tool_calls=[
            {
                "name": "search",
                "args": {"q": "latest revenue"},
                "id": "call_123",
                "type": "tool_call",
            }
        ],
        additional_kwargs={"reasoning_content": "Need a quick lookup first."},
    )

    payload = _convert_message_to_dict_with_reasoning(message)

    assert payload["reasoning_content"] == "Need a quick lookup first."
    assert payload["tool_calls"][0]["id"] == "call_123"


def test_convert_message_to_dict_adds_empty_reasoning_for_tool_calls():
    message = AIMessage(
        content="",
        tool_calls=[
            {
                "name": "search",
                "args": {"q": "latest revenue"},
                "id": "call_456",
                "type": "tool_call",
            }
        ],
    )

    payload = _convert_message_to_dict_with_reasoning(message)

    assert payload["reasoning_content"] == ""
