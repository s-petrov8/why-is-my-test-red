import { test as base } from '@playwright/test';
import { apiRequest as apiRequestOriginal } from './plain-function';
import {
    ApiRequestFn,
    ApiRequestMethods,
    ApiRequestParams,
    ApiRequestResponse,
} from './api-types';

export const test = base.extend<ApiRequestMethods>({
    /**
     * Provides a function to make API requests, bound to the test's Playwright request context.
     *
     * `params` is forwarded wholesale to the underlying helper, so the request contract lives in
     * one place (`api-types.ts` + `plain-function.ts`) and new parameters need no change here.
     * See `plain-function.ts` for the contract: `token` + `authType` produce `Authorization`,
     * `headers` are real request headers merged last (overriding the derived `Content-Type` and
     * `Authorization`), and `body` xor `form` -- `form` implying
     * `application/x-www-form-urlencoded`.
     *
     * The caller's `T` is applied to the body with an assertion rather than a validated
     * conversion. That is the deliberate seam where compile-time typing stops and Zod takes over:
     * specs must still assert `expect(SchemaName.parse(body)).toBeTruthy();`.
     *
     * @param {object} request - The Playwright request context provided by the base fixture.
     * @param {function} use - The use function to provide the API request function.
     */
    apiRequest: async ({ request }, use) => {
        const apiRequestFn: ApiRequestFn = async <T = unknown>(
            params: ApiRequestParams
        ): Promise<ApiRequestResponse<T>> => {
            const { status, body, headers } = await apiRequestOriginal(
                request,
                params
            );

            return { status, body: body as T, headers };
        };

        await use(apiRequestFn);
    },
});
