import { z } from 'zod/v4';
import type { output as zOutput } from 'zod/v4';

/**
 * Schemas for the PIM employee endpoints (`/api/v2/pim/employees`).
 *
 * NOTE: The application publishes no OpenAPI / Swagger document -- every documented
 * path returns 404 or 403. These schemas were therefore derived from live responses
 * and represent the observed contract, not a published one. Re-verify them if the
 * application is upgraded.
 *
 * The response envelope is deliberately spelled out per endpoint rather than shared,
 * because `meta` is not consistent across them: collection responses return
 * `{ total }` while single-resource responses return an empty array.
 */

/**
 * A single employee record as the application returns it.
 *
 * `employeeId` is nullable: the application accepts a create payload that omits it
 * (or sends it as `null`) and answers `200` with `employeeId: null`. Verified
 * against the live application -- a non-nullable schema here rejects a legitimate
 * response.
 */
export const EmployeeSchema = z.strictObject({
    empNumber: z.int(),
    lastName: z.string(),
    firstName: z.string(),
    middleName: z.string(),
    employeeId: z.string().nullable(),
    terminationId: z.int().nullable(),
});

/**
 * Payload accepted by `POST /api/v2/pim/employees`.
 *
 * Verified server-side validation (every rejection is `422 Invalid Parameter`,
 * naming the offending key in `error.data.invalidParamKeys`):
 * - `firstName` / `lastName` -- REQUIRED. Absent, `null`, `''`, and non-strings
 *   are all rejected.
 * - `middleName` -- OPTIONAL. Omitting it returns `200`.
 * - `employeeId` -- OPTIONAL and barely validated. Absent and `null` return `200`
 *   (with `employeeId: null` in the response); a 5-character string is accepted
 *   verbatim. Only non-strings and 16-or-more characters are rejected.
 * - Unknown keys are rejected, so `z.strictObject()` mirrors the server here.
 *
 * `employeeId` is nonetheless declared REQUIRED and constrained to 8 digits. That
 * is a deliberate local policy, STRICTER than the server: it keeps every record
 * this suite creates in the application's canonical format, and it makes a
 * malformed override fail inside the factory rather than silently producing a
 * record with a `null` or short id. It is NOT a description of the contract --
 * do not cite it as one, and build negative payloads outside the factory.
 */
export const CreateEmployeeRequestSchema = z.strictObject({
    firstName: z.string().min(1),
    middleName: z.string().optional(),
    lastName: z.string().min(1),
    employeeId: z.string().regex(/^\d{8}$/),
});

export const DeleteEmployeeRequestSchema = z.strictObject({
    ids: z.array(z.number().min(1)),
});

/** `POST` and `GET /{empNumber}` -- single resource, `meta` is an empty array. */
export const EmployeeResponseSchema = z.strictObject({
    data: EmployeeSchema,
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

/**
 * `GET /api/v2/pim/employees` -- collection, `meta` carries the total count.

 */
export const EmployeeListResponseSchema = z.strictObject({
    data: z.array(EmployeeSchema),
    meta: z.strictObject({ total: z.int() }),
    rels: z.array(z.unknown()),
});

/** `DELETE /api/v2/pim/employees` -- returns the deleted ids as strings, not numbers. */
export const DeleteEmployeesResponseSchema = z.strictObject({
    data: z.array(z.string()),
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

// Type exports
export type Employee = zOutput<typeof EmployeeSchema>;
export type CreateEmployeeRequest = zOutput<typeof CreateEmployeeRequestSchema>;
export type DeleteEmployeeRequest = zOutput<typeof DeleteEmployeeRequestSchema>;
export type EmployeeResponse = zOutput<typeof EmployeeResponseSchema>;
export type EmployeeListResponse = zOutput<typeof EmployeeListResponseSchema>;
export type DeleteEmployeesResponse = zOutput<
    typeof DeleteEmployeesResponseSchema
>;
