import { z } from 'zod/v4';
import type { output as zOutput } from 'zod/v4';

/**
 * Contract for a URL environment variable.
 *
 * Route constants are appended by concatenation (`${APP_URL}${Routes.LOGIN}`),
 * so a trailing slash would produce a double slash in every address.
 */
const urlVariable = z
    .url({
        error: (issue): string =>
            issue.input === undefined ? 'Required' : 'Must be a valid URL',
    })
    .refine((value): boolean => !value.endsWith('/'), {
        error: 'Must not end with a trailing slash',
    });

/**
 * Contract for a required, non-empty plain-string environment variable.
 */
const requiredString = z
    .string({
        error: (issue): string =>
            issue.input === undefined ? 'Required' : 'Must be a string',
    })
    .min(1, 'Must not be empty');

/**
 * The environment contract for this suite.
 *
 * `z.object()` -- NOT `z.strictObject()`. `process.env` carries hundreds of
 * unrelated keys (`PATH`, `HOME`, `CI`, ...); a strict schema would reject every
 * run. The strict-schema rule governs API response schemas, not the process
 * environment.
 *
 * `ADMIN_USERNAME` is `requiredString`, not `z.email()`: the application signs in
 * by username, not by email address (`env/.env.demo` sets `ADMIN_USERNAME=Admin`,
 * which `helpers/app/createStorageState.ts` submits as the `username` field).
 *
 * These two are named for the ADMIN deliberately. They are the credentials
 * `auth.setup.ts` builds the suite's storage state from, so every test that does
 * not sign somebody else in is acting as that administrator -- which is what the
 * `adminSession` fixture is named after. Credentials for any other role belong to
 * the account that needs them, not here.
 *
 * `ENVIRONMENT` is deliberately absent -- it is consumed *before* validation to
 * pick the env file, has a documented default, and cannot come from an env file.
 */
export const EnvSchema = z.object({
    APP_URL: urlVariable,
    API_URL: urlVariable,
    ADMIN_USERNAME: requiredString,
    ADMIN_PASSWORD: requiredString,
    UTILITY_URL: urlVariable.optional(),
});

/**
 * The validated environment. Required variables are `string`, never
 * `string | undefined`.
 */
export type Env = zOutput<typeof EnvSchema>;

let cachedEnv: Env | undefined;

/**
 * Build the multi-line message reported when validation fails.
 *
 * @param error - The Zod failure describing every offending variable.
 * @param loadedFrom - Path of the env file that was attempted, if known.
 * @param loadError - Error returned by `dotenv.config()`, if the file failed to load.
 * @returns A human-readable report naming each variable and the env file used.
 */
function formatEnvError(
    error: z.ZodError,
    loadedFrom?: string,
    loadError?: Error
): string {
    const lines = ['Invalid environment configuration.'];

    if (loadedFrom) {
        const status = loadError
            ? 'file not found -- values must come from the shell or CI'
            : 'file loaded';
        lines.push(`Loaded: ${loadedFrom} (${status})`);
    }

    lines.push('');
    lines.push(
        ...error.issues.map(
            (issue): string => `  ✖ ${issue.path.join('.')}: ${issue.message}`
        )
    );

    return lines.join('\n');
}

/**
 * Validate an environment against {@link EnvSchema} and cache the result.
 *
 * @param source - Environment to validate. Defaults to `process.env`.
 * @param loadedFrom - Path of the env file that was attempted, reported on failure.
 * @param loadError - Error returned by `dotenv.config()`, used to report whether that file loaded.
 * @returns The validated environment.
 * @throws Error naming every missing or malformed variable, plus the env file that was attempted.
 */
export function validateEnv(
    source: NodeJS.ProcessEnv = process.env,
    loadedFrom?: string,
    loadError?: Error
): Env {
    const result = EnvSchema.safeParse(source);

    if (!result.success) {
        throw new Error(formatEnvError(result.error, loadedFrom, loadError));
    }

    cachedEnv = result.data;

    return cachedEnv;
}

/**
 * Return the validated environment, validating on first call if needed.
 *
 * @returns The validated environment.
 * @throws Error naming every missing or malformed variable.
 */
export function getEnv(): Env {
    return cachedEnv ?? validateEnv();
}
