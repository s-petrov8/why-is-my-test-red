import { z } from 'zod/v4';
import type { output as zOutput } from 'zod/v4';

/**
 * Error response schemas for the application's `/api/v2` endpoints.
 *
 * These are app-specific: this application nests everything under an `error` key
 * rather than returning a flat `{ message, error, statusCode }` envelope.
 *
 * NOTE: No OpenAPI / Swagger document is published, so these mirror observed
 * responses rather than a published contract.
 *
 * The `status` field is NOT consistently typed by the application -- 401 returns
 * the number `401` while 422 returns the string `"422"`. Each schema below matches
 * what its own status code actually returns; do not unify them.
 */

/** 401 -- returned for any `/api/v2` call without a valid session cookie. */
export const SessionExpiredResponseSchema = z.strictObject({
    error: z.strictObject({
        status: z.literal(401),
        message: z.string(),
    }),
});

/**
 * 400 -- returned when a business rule refuses the call. `message` names the rule,
 * and `status` is the STRING `'400'`.
 */
export const BadRequestResponseSchema = z.strictObject({
    error: z.strictObject({
        status: z.literal('400'),
        message: z.string(),
    }),
});

/**
 * 403 -- returned when the caller has no access to the record. `status` is the
 * NUMBER `403`.
 */
export const ForbiddenResponseSchema = z.strictObject({
    error: z.strictObject({
        status: z.literal(403),
        message: z.string(),
    }),
});

/**
 * 404 -- returned by `DELETE /pim/employees` when no listed id resolves, e.g. the
 * record was already removed.
 *
 * Note this envelope carries NO `data` key, unlike the 422 below, and its `status`
 * is the STRING `'404'`. Verified against the live application.
 */
export const RecordsNotFoundResponseSchema = z.strictObject({
    error: z.strictObject({
        status: z.literal('404'),
        message: z.string(),
    }),
});

/**
 * 422 -- returned when a path parameter does not resolve, e.g. a deleted resource.

 */
export const InvalidParameterResponseSchema = z.strictObject({
    error: z.strictObject({
        status: z.literal('422'),
        message: z.string(),
        data: z.strictObject({
            invalidParamKeys: z.array(z.string()),
        }),
    }),
});

// Type exports
export type SessionExpiredResponse = zOutput<
    typeof SessionExpiredResponseSchema
>;
export type BadRequestResponse = zOutput<typeof BadRequestResponseSchema>;
export type ForbiddenResponse = zOutput<typeof ForbiddenResponseSchema>;
export type RecordsNotFoundResponse = zOutput<
    typeof RecordsNotFoundResponseSchema
>;
export type InvalidParameterResponse = zOutput<
    typeof InvalidParameterResponseSchema
>;
