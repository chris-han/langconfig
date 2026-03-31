from langchain_core.messages import AIMessage

from core.middleware.core import PIIMiddleware, ValidationMiddleware


def test_validation_middleware_preserves_tool_calls_and_reasoning_content():
    middleware = ValidationMiddleware(required_patterns=["missing-token"])
    original = AIMessage(
        content="short answer",
        tool_calls=[
            {
                "name": "search",
                "args": {"q": "journal entry workflow"},
                "id": "call_789",
                "type": "tool_call",
            }
        ],
        additional_kwargs={"reasoning_content": "Need to search before answering."},
        response_metadata={"reasoning_content": "Need to search before answering."},
    )

    result = middleware.after_model({"messages": [original]}, runtime=None)

    assert result is not None
    preserved = result["messages"][-1]
    assert preserved.tool_calls == original.tool_calls
    assert preserved.additional_kwargs["reasoning_content"] == "Need to search before answering."
    assert preserved.response_metadata["reasoning_content"] == "Need to search before answering."


def test_pii_middleware_preserves_tool_calls_and_reasoning_content():
    middleware = PIIMiddleware(patterns={"email": r"[\w\.-]+@[\w\.-]+\.\w+"})
    original = AIMessage(
        content="contact me at user@example.com",
        tool_calls=[
            {
                "name": "email_lookup",
                "args": {"email": "user@example.com"},
                "id": "call_999",
                "type": "tool_call",
            }
        ],
        additional_kwargs={"reasoning_content": "Need to sanitize the email before replay."},
        response_metadata={"reasoning_content": "Need to sanitize the email before replay."},
    )

    result = middleware.before_model({"messages": [original]}, runtime=None)

    assert result is not None
    preserved = result["messages"][-1]
    assert preserved.tool_calls == original.tool_calls
    assert preserved.additional_kwargs["reasoning_content"] == "Need to sanitize the email before replay."
    assert preserved.response_metadata["reasoning_content"] == "Need to sanitize the email before replay."
