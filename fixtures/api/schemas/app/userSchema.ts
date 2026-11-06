import { z } from 'zod/v4';
import type { output as zOutput } from 'zod/v4';
import { EmployeeSchema } from './employeeSchema';

/**
 * Schemas for the admin user endpoints (`/api/v2/admin/users`). They match what the
 * application does, and each `FIXME` names where its annotations differ. The annotations
 * are confirmed stale.
 *
 * FIXME: no ticket yet. The annotations document only 200 and 404 on these endpoints.
 * They also answer 401, 403 and 422, which the tests assert.
 */

/** The role attached to a user account, as the application returns it. */
export const UserRoleSchema = z.strictObject({
    id: z.int(),
    name: z.string(),
    displayName: z.string(),
});

/**
 * A user account as the application returns it.
 *
 * FIXME: no ticket yet. The annotations type `employee.terminationId` as an integer and
 * `employee.employeeId` as a string. Both can be `null`, and `terminationId` is `null`
 * on every active account.
 */
export const UserSchema = z.strictObject({
    id: z.int(),
    userName: z.string(),
    deleted: z.boolean(),
    status: z.boolean(),
    employee: EmployeeSchema,
    userRole: UserRoleSchema,
});

/**
 * Payload accepted by `POST /api/v2/admin/users`.
 */
export const CreateUserRequestSchema = z.strictObject({
    username: z.string().min(5),
    password: z.string().min(8),
    status: z.boolean(),
    userRoleId: z.int(),
    empNumber: z.int(),
});

/**
 * Payload accepted by `PUT /api/v2/admin/users/{id}` when the password stays as it is.
 *
 * FIXME: no ticket yet. The annotations don't list `changePassword` as required, and the
 * API answers 422 without it. `password` is required even when it isn't changing.
 */
export const UpdateUserRequestSchema = z.strictObject({
    username: z.string().min(5),
    password: z.literal(''),
    changePassword: z.literal(false),
    status: z.boolean(),
    userRoleId: z.int(),
    empNumber: z.int(),
});

/**
 * `POST`, `PUT` and `GET /{id}` -- single resource, `meta` is an empty array.
 *
 * FIXME: no ticket yet. The annotations document `meta` as an object, and don't document
 * `rels`.
 */
export const UserResponseSchema = z.strictObject({
    data: UserSchema,
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

/**
 * `GET /api/v2/admin/users` -- collection, `meta` carries the total count.
 *
 * FIXME: no ticket yet. The annotations don't document `rels`.
 */
export const UserListResponseSchema = z.strictObject({
    data: z.array(UserSchema),
    meta: z.strictObject({ total: z.int() }),
    rels: z.array(z.unknown()),
});

/**
 * `DELETE /api/v2/admin/users` -- returns the deleted ids.
 *
 * FIXME: no ticket yet. The annotations' `DeleteResponse` documents `meta` as an object
 * and doesn't document `rels`.
 */
export const DeleteUsersResponseSchema = z.strictObject({
    data: z.array(z.int()),
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

/**
 * `POST /api/v2/auth/public/validation/password` -- what the password check says.
 * `POST /admin/users` refuses a password without a reason; this names the rule.
 *
 * FIXME: no ticket yet. The annotations place this at `/api/v2/auth/validation/password`,
 * list `name` as the required field where the API validates `password`, and don't
 * document `rels`.
 */
export const PasswordCheckResponseSchema = z.strictObject({
    data: z.strictObject({ messages: z.array(z.string()) }),
    meta: z.strictObject({ strength: z.int() }),
    rels: z.array(z.unknown()),
});

// Type exports
export type UserRole = zOutput<typeof UserRoleSchema>;
export type User = zOutput<typeof UserSchema>;
export type CreateUserRequest = zOutput<typeof CreateUserRequestSchema>;
export type UpdateUserRequest = zOutput<typeof UpdateUserRequestSchema>;
export type UserResponse = zOutput<typeof UserResponseSchema>;
export type UserListResponse = zOutput<typeof UserListResponseSchema>;
export type DeleteUsersResponse = zOutput<typeof DeleteUsersResponseSchema>;
