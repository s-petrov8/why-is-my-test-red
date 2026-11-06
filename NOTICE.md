# Third-Party Notices

This repository includes the following third-party components. Each remains under its own upstream license, which governs that component regardless of this repository's top-level license.

## agentic-playwright

- **Path:** `AGENTS.md`, `.claude/skills/`, `.agents/skills/`, `.claude/scripts/`, `.claude/settings.json`, `skills-lock.json`, `scripts/playwright-cli.sh`, `scripts/playwright-cli.cmd`. Project overrides at the top of `AGENTS.md` are this repository's own. The skills below keep their own licenses.
- **Source:** [idavidov13/agentic-playwright](https://github.com/idavidov13/agentic-playwright) v2.0.1
- **License:** MIT

```text
MIT License

Copyright (c) 2026 Ivan Davidov and Agentic Playwright contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## skill-creator

- **Path:** `.claude/skills/skill-creator/` (generated into `.agents/skills/`)
- **Source:** [anthropics/skills](https://github.com/anthropics/skills) (`skills/skill-creator`)
- **License:** Apache License 2.0 — see `.claude/skills/skill-creator/LICENSE.txt`
- **Copyright:** Anthropic, PBC

## playwright-cli skill

- **Path:** `.claude/skills/playwright-cli/` (generated into `.agents/skills/`)
- **Source:** the [`@playwright/cli`](https://www.npmjs.com/package/@playwright/cli) npm package (skill documentation bundled with the package). Vendored copy is locally customized; provenance and hashes are tracked in `skills-lock.json`.
- **License:** Apache License 2.0
- **Copyright:** Microsoft Corporation

## Playwright

[Playwright](https://playwright.dev/) and [`@playwright/test`](https://www.npmjs.com/package/@playwright/test) are open-source projects by Microsoft Corporation, consumed here as npm dependencies (Apache License 2.0). This project is not affiliated with or endorsed by Microsoft.
