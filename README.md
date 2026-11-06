# why-is-my-test-red

A learning project: a tool that explains why a test failed in CI. It will give each failure a verdict with evidence, using test output, application logs and what changed since the last passing build.

The analyser does not exist yet. So far, this repo holds the system it will examine: a Playwright suite running against a private OrangeHRM.

## What's here

- `tests/`, `pages/`, `fixtures/`, `helpers/`: the Playwright and TypeScript suite, copied from [playwright-qa-portfolio](https://github.com/s-petrov8/playwright-qa-portfolio).
- `infra/`: starts OrangeHRM and MariaDB with Docker Compose and installs OrangeHRM unattended.
- `.github/workflows/orangehrm-suite.yml`: runs the suite, one fresh instance per run, and uploads the test report and application logs.

## Run it

In GitHub Actions, run **OrangeHRM suite** by hand and choose the OrangeHRM version, the number of runs and whether to use debug logging.

Locally, this starts an instance on port 8080 and runs the suite against it. It needs Docker and `envsubst`, and the suite can run any number of times against one instance.

```bash
export DB_ROOT_PASSWORD="$(openssl rand -hex 16)"
export ADMIN_USERNAME=Admin
export ADMIN_PASSWORD="Local-$(openssl rand -hex 12)-Aa1"

COMPOSE_PROJECT_NAME=ohrm-a infra/start-orangehrm.sh
APP_URL=http://localhost:8080 API_URL=http://localhost:8080 npx playwright test
```

### Run several instances at once

Give each instance its own Compose project and port. Without a project name, every checkout uses the project `infra` and they replace each other's containers.

```bash
COMPOSE_PROJECT_NAME=ohrm-b OHRM_PORT=8081 infra/start-orangehrm.sh
```

Run each suite from its own checkout or git worktree, because `.auth/`, `test-results/` and `playwright-report/` belong to the checkout.

```bash
APP_URL=http://localhost:8081 API_URL=http://localhost:8081 npx playwright test
```

Remove an instance and its data with:

```bash
COMPOSE_PROJECT_NAME=ohrm-b docker compose -f infra/docker-compose.yml down -v
```

## Credits

The suite is built on Ivan Davidov's Playwright scaffold, and its agent rules and skills come from [agentic-playwright](https://github.com/idavidov13/agentic-playwright) v2.0.1 (MIT). `NOTICE.md` lists its third-party components. OrangeHRM is [a separate GPL-3.0 project](https://github.com/orangehrm/orangehrm), pulled as a Docker image and not included in this repo.
