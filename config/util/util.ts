import { getEnv } from '../env';

const env = getEnv();

/**
 * Utility service configuration object.
 * Contains URL configuration for utility/helper services.
 *
 * Values come from the validated environment contract in `config/env.ts`.
 *
 * For API endpoints, use enums from `enums/` folder.
 */
export const utilityConfig = {
    /** Utility service base URL loaded from the optional UTILITY_URL env variable */
    baseUrl: env.UTILITY_URL,
};

/**
 * An explicitly empty storage state, for code that must run unauthenticated.
 *
 * Use it as `test.use({ storageState: ANONYMOUS_STORAGE_STATE })` in specs, and as
 * the `storageState` option of `request.newContext(...)` in helpers.
 */
export const ANONYMOUS_STORAGE_STATE = { cookies: [], origins: [] };
