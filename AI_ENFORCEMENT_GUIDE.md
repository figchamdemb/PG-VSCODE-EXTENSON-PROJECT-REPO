# AI Enforcement Guide

LAST_UPDATED_UTC: 2026-03-13 01:39
UPDATED_BY: codex

## Purpose
This file explains what the repository can enforce for AI agents and what still depends on the host extension/editor.

## The Real Split
- Repo-level enforcement:
  - `AGENTS.md`
  - `ANTIGRAVITY.md`
  - `GEMINI.md`
  - `.agents/workflows/startup.md`
  - `.githooks/pre-commit`
  - `scripts/memory_bank_guard.py`
  - `scripts/self_check.ps1`
- Extension/editor-level enforcement:
  - whether the extension injects repo instructions before the first answer
  - whether the extension supports slash/workflow startup commands
  - whether the extension treats startup instructions as hard blockers or as soft guidance

## What This Repo Can Do
- Put the required startup sequence at the top of agent-specific instruction files.
- Use explicit stop-if-not-started language instead of passive checklist language.
- Keep the real enforcement path in hooks, self-checks, and Memory-bank guard scripts.
- Provide optional workflow files for tools that support repo-local startup workflows.
- For Narrate itself, auto-detect the nearest active `AGENTS.md` / `pg.ps1` context and run `.\pg.ps1 start -Yes` once per context per UTC day.
- For Narrate itself, collect active-file editor diagnostics locally, send active file content/context to backend Trust evaluation, and block guarded commands when backend Trust returns blockers or cannot evaluate.

## What This Repo Cannot Guarantee
- It cannot force a third-party extension to read local files before the extension decides to answer.
- It cannot guarantee that `/startup` exists unless the extension actually supports repo workflow commands.
- It cannot replace editor-level system prompts with markdown alone.
- It still cannot hard-block unrelated third-party chat extensions unless those extensions integrate with Narrate's startup/runtime APIs directly.

## Current Startup Contract
Before an agent works in this repo, it should:
1. Run `.\pg.ps1 start -Yes`
2. Read:
   - `Memory-bank/daily/LATEST.md`
   - the latest daily report
   - `Memory-bank/project-spec.md`
   - `Memory-bank/project-details.md`
   - `Memory-bank/structure-and-db.md`
   - recent `Memory-bank/agentsGlobal-memory.md` entries
   - `Memory-bank/tools-and-commands.md`
   - `Memory-bank/coding-security-standards.md`
   - open decisions in `Memory-bank/mastermind.md`
3. Stop and report failure if startup cannot be completed

## Why Antigravity/Gemini Needed Stronger Wording
- Cursor-style products often hard-inject workspace rules before the model sees the first user prompt.
- Extension-based agents may receive repo docs as lower-priority context.
- Passive wording like "Before coding" is easier for those agents to skip when the user prompt sounds urgent.

## What Was Added
- Stronger startup override sections in `ANTIGRAVITY.md` and `GEMINI.md`
- `.agents/workflows/startup.md` as an optional repo workflow helper
- This explainer so the limitation is documented honestly instead of being described as guaranteed editor-level enforcement

## Bottom Line
- These files improve compliance for Antigravity/Gemini-style extensions.
- The truly enforceable layer remains the repo scripts, hooks, self-checks, and Memory-bank guard path.
- Narrate now adds its own extension-native startup guard for current-context PG repos and a server-backed Trust Score path, but those guards only apply inside Narrate's runtime unless another agent extension explicitly integrates with it.
