@AGENTS.md

## Claude Code only

- `.claude/skills/` is the canonical skill tree, and `.agents/skills/` is a copy of it. Edit a skill in `.claude/skills/` only.
- `.claude/settings.json` wires `enforce_constitution.py` as a PreToolUse hook on Write, Edit and MultiEdit. It blocks a mechanical Constitution violation before the file is written and names the rule.
- `.claude/scripts/`, `.claude/settings.json` and `.playwright-cli/` are protected paths, and the hook refuses an agent's write there.
- A new `*.page.ts` or `*.component.ts` file under `pages/` needs a fresh `playwright-cli` exploration marker, which `scripts/playwright-cli.sh` touches.
