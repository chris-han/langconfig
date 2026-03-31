# Coding Agent Eval Rubric

Score each dimension from `0` to `3`.

## 1. Deliverable Accuracy
- `3`: Produces the exact requested artifact or fix.
- `2`: Mostly correct but missing a minor requested detail.
- `1`: Partially addresses the task but misses the main deliverable.
- `0`: Does not solve the requested task.

## 2. Planning Depth Fit
- `3`: Uses planning depth appropriate to task complexity.
- `2`: Reasonable plan, but overthinks or underthinks parts of the task.
- `1`: Planning quality materially mismatches the task.
- `0`: No meaningful plan for a complex task, or wasteful planning for a simple task.

## 3. Context Efficiency
- `3`: Gathers only relevant context and avoids unnecessary scans.
- `2`: Some extra exploration, but still mostly efficient.
- `1`: Noticeable redundant exploration or large irrelevant context pulls.
- `0`: Runaway exploration, excessive broad search, or major context waste.

## 4. Post-Write Closure
- `3`: Stops after the deliverable is created and targeted verification is complete.
- `2`: Performs one or two unnecessary follow-up actions but still closes reasonably.
- `1`: Continues exploring after completion in a way that wastes time or tokens.
- `0`: Fails to close the loop and significantly overruns after the deliverable exists.

## 5. Verification Quality
- `3`: Runs focused verification that directly tests the change.
- `2`: Verification exists but is indirect, shallow, or broader than needed.
- `1`: Minimal or weak verification.
- `0`: No verification and no clear statement of the gap.

## 6. Scope Control
- `3`: Keeps work tightly aligned to the request.
- `2`: Minor scope expansion with limited cost.
- `1`: Significant unnecessary expansion.
- `0`: Major speculative work unrelated to the task.

## 7. Code Or Artifact Quality
- `3`: Output is clear, coherent, maintainable, and fit for use.
- `2`: Mostly solid, with minor quality issues.
- `1`: Works partially but is bloated, confusing, or fragile.
- `0`: Low-quality output that is not practically usable.

## 8. Prompt-Following For Coding Tasks
- `3`: Demonstrates minimal runnable slice, targeted verification, and explicit closure.
- `2`: Follows most prompt expectations with small misses.
- `1`: Misses several important operating instructions.
- `0`: Clearly violates the intended coding-agent behavior.

## Failure Flags
Any of these should trigger automatic concern even if aggregate score is acceptable:
- Keeps exploring after writing the requested files.
- Performs broad repository scans after completion without clear necessity.
- Exceeds context budget due to redundant inspection.
- Produces generic scaffolding instead of the requested targeted solution.
- Expands scope without user request.

## Recommended Interpretation
- `21-24`: Strong
- `16-20`: Acceptable but needs tuning
- `10-15`: Weak; revise prompt or loop controls
- `0-9`: Failing behavior; fix prompt, stopping criteria, or runtime limits before reuse
