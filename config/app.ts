import { getEnv } from './env';

const env = getEnv();

/**
 * Application configuration object.
 * Contains URL configuration for the main application.
 *
 * Values come from the validated environment contract in `config/env.ts`, so
 * every property is `string` -- never `string | undefined`.
 *
 * For route paths and API endpoints, use enums from `enums/app/app.ts`.
 */
export const appConfig = {
    /** Frontend application URL loaded from APP_URL env variable */
    appUrl: env.APP_URL,
    /** Backend API URL loaded from API_URL env variable */
    apiUrl: env.API_URL,
};
