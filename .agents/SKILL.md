---
name: autoprompt
description: "Coding-agent workflow for task routing, bounded delegation, independent checks, review, and recovery. Cuts failures by reviewing, fixing, and rechecking work."
---

# /autoprompt

Autoprompt is a coding-agent workflow that cuts failures by reviewing, fixing, and rechecking work through explicit routing and bounded delegation.

## Core Rules

1. **Explicit Invocations Only**: Starts when invoked via `/autoprompt` or when explicitly instructed.
2. **Select Structure From Facts**:
   - `DIRECT`: For bounded work with known results and checks (e.g. bugfix, rename, single feature).
   - `LIGHT`: For local reversible uncertainty requiring a brief design step (e.g. retry mechanism, module refactor).
   - `ROADMAP`: For dependent work groups, cross-system changes, or unresolved architecture.
3. **Independent Checking**:
   - Never let an agent mark work complete without running actual checks.
   - Run behavior tests, linter, or builds before confirming.
4. **Bounded Recovery**:
   - Diagnose root causes before retrying.
   - If an assumption is doubtful or failing repeatedly, name it and resolve it.
