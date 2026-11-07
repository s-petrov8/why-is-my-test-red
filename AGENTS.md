# Playwright Scaffold

Rules for every agent in this repository. Skills hold the detail; load the one the index names first.

## Project overrides

These win over the Constitution and the skills, because they change the evidence the failure analyser sees.

- **Environment:** read variables through `getEnv()` from `config/env.ts`, never `process.env`. `ENVIRONMENT` and `CI` in `playwright.config.ts` are the two exceptions. A new variable goes into `EnvSchema` first, and `EnvSchema` is the one allowed `z.object()`.
- **Traces:** `trace: 'retain-on-failure'`. The first failure must keep its trace.
- **Retries and workers:** `retries: 0` and `workers: 1`, so a flake shows up as a failure.
- **Target:** the suite runs against a private, throwaway OrangeHRM, started by `infra/`, on one fresh instance per run. Configuration a fresh install lacks goes in `tests/app/seed.setup.ts`.
- **Existing tests:** they follow the Constitution once they are next edited. New tests follow it from the start.
- **Known flake:** the `AND semantics` test in `tests/app/api/employeeSearch.spec.ts` stays as it is, as a known real failure for the analyser.
- **Setup, teardown and shared helpers:** fixtures, `tests/app/seed.setup.ts`, cleanup hooks and the helpers tests share check the status, with the response body in the assertion's message, and read only the fields they need, with no strict parse or shape comparison, so a bug in a response fails one test and doesn't stop the suite. A test whose subject is a value asserts it in its own body. One owning test validates each shape, under `tests/app/api/`: `employee.spec.ts` for employees; `reportingLine.spec.ts` for reporting lines; `termination.spec.ts` for termination records and job details; `leaveShapes.spec.ts` for leave type lists, entitlement grants, leave requests (create, read, list, status change), refusals, balances, leave days, holidays, reading the work week and the leave period; `adminShapes.spec.ts` for user accounts and work shifts; `adminUsers.spec.ts` for the password check; `leaveBalance.spec.ts` for leave type create and delete, eligible types, and entitlement read and delete; `leaveWorkingDays.spec.ts` for updating the work week; `leaveStatus.spec.ts` for single-day changes and 403s; `leaveValidation.spec.ts` for 404s and 422s.
- **Response Validation:** a test may use a schema's parsed value, `const parsed = Schema.parse(body)`, as well as the exact `expect(SchemaName.parse(body)).toBeTruthy();` form.

## Constitution

`{area}` is the app folder; `ls pages/` (or `tests/`, `enums/`) gives the real name.

### MUST

- **Dependency Injection**: page objects are fixtures from `fixtures/pom/test-options.ts`.
- **Imports**: `test` and `expect` from `fixtures/pom/test-options.ts` only, never `@playwright/test`.
- **Selectors**: `getByRole()` > `getByLabel()` > `getByPlaceholder()` > `getByText()` > `getByTestId()`.
- **Type Safety**: Zod schemas in `fixtures/api/schemas/`; no `any`.
- **Strict Schemas**: API schemas use `z.strictObject()`.
- **Response Validation**: exactly `expect(SchemaName.parse(body)).toBeTruthy();`.
- **Sources of Truth**: URLs and credentials from `process.env.*` (`env/.env.example`); endpoint paths, routes, messages and storage-state paths from `enums/{area}/*` and `enums/util/*`.
- **Assertions**: web-first, `expect(locator).toBeVisible()`; never `waitForTimeout()`.
- **Linting**: ESLint and Prettier clean, zero warnings.
- **Data Strategy**: invalid arrays in `test-data/static/util/invalid-values.ts`; curated sets in `test-data/static/{area}/`; happy-path data from `test-data/factories/{area}/`.
- **State Cleanup**: a test that mutates persistent state reverts it in `afterEach` or `afterAll`.
- **API Test Steps**: two or more API calls means one `test.step()` per call.
- **Test Verification**: run `npx playwright test <file>` after editing a spec; red is never done.
- **Explore Before Generate**: API: build from the OpenAPI document; live capture only when none exists, flagged; a runtime mismatch is `test.skip` plus `// FIXME:`, never a loosened schema. UI: you explore with `playwright-cli` (read that skill first) before you write any `pages/**` file, UI spec or selector; cannot run means stop and tell the human.

### SHOULD

- **Data Generation**: Faker factories in `test-data/factories/` for happy-path values, UI content too.
- **Test Isolation**: independent tests; `test.beforeEach` for setup.
- **Test Steps**: `test.step()` with Given/When/Then.
- **JSDoc on Actions**: JSDoc (`@param`, `@returns`) on action methods only.
- **Enums for Strings**: repeated strings come from `enums/`.

### WON'T

- **No XPath**.
- **No Hard Waits**: never `page.waitForTimeout()`.
- **No Secrets**: never a hardcoded credential.
- **No `any`**.
- **No Tags on Describe**: never on `test.describe()`.
- **No Multiple Tags**: exactly one of `@smoke`, `@sanity`, `@regression`, `@e2e`, `@api`, `@destructive`; never `@functional`. `@destructive` alone when shared state (locale, roles, settings) is mutated, not for own-data cleanup.
- **No Magic Numbers**: constants in `config/` or `enums/`.
- **No Manual Instantiation**: never `new PageObject(page)`.
- **No Loose Schemas**: never `z.object()`.
- **No JSDoc on Locators**.
- **No Hardcoded Test Content**: names, labels and text come from factories.
- **No Explore-Only Files**: never commit a page-dump or probe spec.
- **No Empty-Body-Only 400**: per-field omission and invalid-type `for...of` tests.
- **No Feedback-Less POM**: form and CRUD page objects have success, error and validation selectors.
- **No Substitute UI Exploration**: no IDE or MCP browser, no `codegen`; only `playwright-cli`.
- **No Silent Coverage Drops**: every documented status code has a test or a `test.skip` with `// FIXME`.
- **No JSON Static Data**: `test-data/static/**` is `.ts` with `as const`.

## Workflow

- **Proceed**: load `ai-native-workflow` first on every non-trivial task; it routes, explores and stops at a confidence-scored proposal before any edit. One-line fix, typo or single import: direct mode, verify the premise, apply, report.
- **Verify**: `npm run lint`, then `npx playwright test <affected files>`; red means `debugging`, never a skipped or loosened test.
- **Commit**: ask first; one verified task per commit, Conventional Commit subject; never `test.only` or a real env file.

## Skills Index

Your harness loads skills from its native directory. Claude Code uses `.claude/skills/`, Codex, Cursor and Copilot use `.agents/skills/`.

- `ai-native-workflow`: first on any non-trivial task.
- `playwright-cli`: exploring the live app before any UI code.
- `selectors`: choosing or reviewing a locator.
- `page-objects`: a page object or component under `pages/**`.
- `fixtures`: registering a page object; setup/teardown fixtures.
- `test-standards`: a spec under `tests/**`; type, tag, loop, cleanup.
- `api-testing`: an API spec, endpoint coverage, a schema from the contract.
- `type-safety`: a Zod schema, inferred types, `any`, `!` versus `??`.
- `data-strategy`: a factory or static set; generated versus static.
- `enums`: an endpoint path, route, message, role or storage-state path.
- `config`: an environment variable, config property or utility URL.
- `helpers`: a plain function under `helpers/**`; the auth bootstrap.
- `common-tasks`: a prompt template; the verification checklist.
- `refactor-values`: changing an existing enum or static value.
- `debugging`: a failing, flaky or slow test; a `ZodError`; CI-only red.
- `pr-reviewer`: reviewing a named branch against the base.
- `skill-creator`: creating or improving a skill.

## Before you report done

1. `npm run lint` clean; affected tests green; no `test.only`.
2. A failing check is a rule you missed: fix the cause, never bypass the check.
3. Generated artifacts went through the `common-tasks` verification checklist.
4. Report files changed, lint and test status; ask before committing.
