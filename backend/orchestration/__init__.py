# Copyright (c) 2025 Cade Russell (Ghost Peony)
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

"""LangGraph-based orchestration system for LangConfig."""

# Keep package import safe even when optional legacy modules are absent.
try:
    from .graph_state import (
        ClassificationType,
        ExecutorType,
        WorkflowState,
        WorkflowStatus,
        create_initial_state,
    )

    __all__ = [
        "WorkflowState",
        "WorkflowStatus",
        "ClassificationType",
        "ExecutorType",
        "create_initial_state",
    ]
except ImportError:
    __all__: list[str] = []
