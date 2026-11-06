import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { validateEnv } from './config/env';
import { StorageStatePaths } from './enums/app/app';

/**
 * Load environment variables from .env file.
 * Defaults to ./env/.env.dev if ENVIRONMENT is not set.
 *
 * Usage:
 *   ENVIRONMENT=staging npx playwright test
 */
const environment = process.env.ENVIRONMENT ?? 'dev';
const environmentPath = `./env/.env.${environment}`;

const dotenvResult = dotenv.config({ path: environmentPath });

/**
 * Fail fast on a broken environment.
 *
 * Called *after* dotenv so the file's values are in `process.env`. A missing
 * file is not an error by itself -- CI injects the values through the shell --
 * so only missing or malformed *variables* throw, and the message reports which
 * file was attempted and whether it loaded.
 */
validateEnv(process.env, environmentPath, dotenvResult.error);

/**
 * Playwright Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './tests',

    /* Run tests in files in parallel */
    fullyParallel: true,

    /* Fail the build on CI if you accidentally left test.only in the source code */
    forbidOnly: !!process.env.CI,

    /* No retries anywhere -- a retry hides an intermittent failure instead of
       reporting it, and re-running regenerates factory data, so the retry no
       longer reflects the run that failed. */
    retries: 0,

    /* Single worker everywhere.
       The demo application serialises poorly: concurrent workers push the login
       POST's latency past `actionTimeout`, producing intermittent failures whose
       artifacts show the app answering correctly, just late. Measured on this
       suite, parallel execution also bought no wall-clock time (18 tests take
       ~1 minute either way), so the concurrency is pure downside here. */
    workers: 1,

    /* Reporter configuration */
    reporter: process.env.CI
        ? [['blob'], ['html', { open: 'never' }]]
        : [['html', { open: 'on-failure' }]],

    /* Shared settings for all projects */
    use: {
        /* Base URL - uncomment and set if using relative URLs */
        // baseURL: process.env.APP_URL,

        /* Collect a trace for every failed test.
           NOT `on-first-retry`: with `retries: 0` there is never a first retry,
           so that setting would silently never produce a trace at all. */
        trace: 'retain-on-failure',

        /* Screenshot on failure */
        screenshot: 'only-on-failure',

        /* Video on failure */
        video: 'retain-on-failure',

        /* Action timeout -- also bounds APIRequestContext calls, and the demo
           application's login POST occasionally needs more than 10s. */
        actionTimeout: 30000,

        /* Navigation timeout */
        navigationTimeout: 30000,
    },

    /* Test timeout */
    timeout: 60000,

    /* Expect timeout */
    expect: {
        timeout: 10000,
    },

    /* Configure projects */
    projects: [
        /* Setup project - runs before main tests */
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/,
        },

        /* Main test project - Chrome */
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: StorageStatePaths.APP,
                viewport: { width: 1920, height: 1080 },
            },
            dependencies: ['setup'],
        },
    ],
});
