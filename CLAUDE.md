# Conventions

Rules for writing code here. Three of them supersede the scaffold this project was built on;
those are marked. Follow the rule as stated here.

**Environment.** Read variables through `getEnv()` from `config/env.ts` — never `process.env`,
and never `!` or `??` to cover a possibly-missing one; `getEnv()` returns them validated and
typed as `string`. A new variable goes into `EnvSchema` first. _Supersedes the scaffold_, which
reads `process.env.*` at each call site. Two exceptions, both in `playwright.config.ts`:
`ENVIRONMENT`, read before validation because it picks the env file, and Playwright's own `CI`.

**Page objects.** One per application page, in `pages/app/`. Locators are get-accessors,
resolved lazily; a page object holds nothing but its `Page`, and no state between calls. Locators
live in page objects only — a spec that builds one has to be edited when the markup changes.
Prefer role, label and text locators over CSS; avoid positional `nth` selectors.

**Registration.** Every page object is registered in `fixtures/pom/page-objects.ts`, the only
file that constructs them. Registering there is all it takes — _do not write a fixture per page_,
as the scaffold did.

**Fixtures.** Import `test` and `expect` from `fixtures/pom/test-options.ts`, never from
`@playwright/test`. Merge a new fixture into that file. Preconditions belong to the domain
fixture that owns them: `user-fixture` (throwaway people, signing them in), `pim-fixture` (a
temporary employee), `leave-fixture` (an applicant, a supervisor, an entitlement, a reporting
line). Add a new domain fixture rather than growing one into a general-purpose helper —
_supersedes the scaffold's single generic `helper-fixture.ts`_.

**Sessions.** `adminSession` is the pre-authenticated administrator; `signInAs(user)` is anybody
else, in a context of its own, and several can be live at once. Both return the same
`PageObjects` shape, so a test reads the same whichever role it acts as.

**Test data.** Every suite creates what it needs and destroys it in teardown, over the API rather
than the UI. Never assert on a record the suite did not create — the target is a public demo
anybody can change mid-run. Three tiers, chosen by how variable the data is:

- `test-data/static/` — `as const` literals for invalid inputs an endpoint must reject.
  TypeScript, not JSON, so `undefined` is expressible; no imports, functions or computed values.
- `test-data/factories/` — Faker-backed builders for valid records that must differ per run.
- `helpers/app/` — API calls that make state exist in the application itself.

**API tests.** Parse every asserted response through a schema in `fixtures/api/schemas/`, using
`z.strictObject()` so an added, renamed or dropped field fails the run instead of passing
quietly. `EnvSchema` is the one correct loose `z.object()`, because `process.env` carries
hundreds of keys this suite does not own. Make requests through the `apiRequest` fixture.
Endpoints, routes, message strings and role or status ids come from `enums/app/app.ts` — no
string literals for those in a spec.

**Waiting.** Web-first assertions only (`await expect(locator).toBeVisible()`); they retry
themselves. No `waitForTimeout`, no `page.pause()`, no sleeping, no `force: true` — if an
interaction needs forcing, the assertion before it is wrong.

**Structure.** Every spec sits in a top-level `test.describe`. Tag tests `@api`, `@e2e`, `@smoke`
or `@regression`; the `test:*` scripts select on those. `@destructive` is reserved for a test
that mutates shared state it cannot clean up — nothing here needs it, because suites provision
their own data.

**Config.** `retries: 0` and `workers: 1` are measured, not defaults left unread: a retry
regenerates factory data, so a passing retry no longer describes the run that failed, and
concurrency pushes this application's login POST past `actionTimeout` while buying no wall-clock
time. Do not raise either to make a flaky test pass — read the trace `retain-on-failure` keeps.

**Style.** Prettier owns formatting and `.prettierrc` is its only configuration (4-space indent,
single quotes, 80 columns, semicolons); do not restate those options anywhere else. Run
`npm run lint` and `npm run format` before committing. Every exported function, type and fixture
gets a JSDoc block, and comments say why rather than restating the line. No `console` — the one
lint-suppressed `console.warn` in `plain-function.ts`, for a response body that failed to parse,
is the deliberate exception.
