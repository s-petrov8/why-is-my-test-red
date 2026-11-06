import { z } from 'zod/v4';
import type { output as zOutput } from 'zod/v4';
import { EmployeeSchema } from './employeeSchema';

/** Schemas for the admin user endpoints (`/api/v2/admin/users`). */

/** The role attached to a user account, as the application returns it. */
export const UserRoleSchema = z.strictObject({
    id: z.int(),
    name: z.string(),
    displayName: z.string(),
});

/**
 * A user account as the application returns it.
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

/** `POST` and `GET /{id}` -- single resource, `meta` is an empty array. */
export const UserResponseSchema = z.strictObject({
    data: UserSchema,
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

/** `GET /api/v2/admin/users` -- collection, `meta` carries the total count. */
export const UserListResponseSchema = z.strictObject({
    data: z.array(UserSchema),
    meta: z.strictObject({ total: z.int() }),
    rels: z.array(z.unknown()),
});

/** `DELETE /api/v2/admin/users` -- returns the deleted ids as numbers. */
export const DeleteUsersResponseSchema = z.strictObject({
    data: z.array(z.number()),
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

// Type exports
export type UserRole = zOutput<typeof UserRoleSchema>;
export type User = zOutput<typeof UserSchema>;
export type CreateUserRequest = zOutput<typeof CreateUserRequestSchema>;
export type UserResponse = zOutput<typeof UserResponseSchema>;
export type UserListResponse = zOutput<typeof UserListResponseSchema>;
export type DeleteUsersResponse = zOutput<typeof DeleteUsersResponseSchema>;
