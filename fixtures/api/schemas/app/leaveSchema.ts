import { z } from 'zod/v4';
import type { output as zOutput } from 'zod/v4';
import { EmployeeSchema } from './employeeSchema';

/** * Schemas for the leave endpoints (`/api/v2/leave/*`). */

/** A leave type configured on the instance. */
export const LeaveTypeSchema = z.strictObject({
    id: z.int(),
    name: z.string(),
    deleted: z.boolean(),
    situational: z.boolean(),
});

/** `GET /api/v2/leave/leave-types` -- collection, `meta` carries the total count. */
export const LeaveTypeListResponseSchema = z.strictObject({
    data: z.array(LeaveTypeSchema),
    meta: z.strictObject({ total: z.int() }),
    rels: z.array(z.unknown()),
});

/** How an entitlement came to exist, e.g. `Added` for one granted by an admin. */
export const EntitlementTypeSchema = z.strictObject({
    id: z.int(),
    name: z.string(),
});

/**
 * A leave entitlement -- the days of one leave type an employee may draw on
 * within one leave period.
 */
export const LeaveEntitlementSchema = z.strictObject({
    id: z.int(),
    employee: EmployeeSchema,
    entitlement: z.number(),
    daysUsed: z.number(),
    leaveType: z.strictObject({
        id: z.int(),
        name: z.string(),
        deleted: z.boolean(),
    }),
    fromDate: z.string(),
    toDate: z.string(),
    creditedDate: z.string(),
    entitlementType: EntitlementTypeSchema,
    deleted: z.boolean(),
    deletable: z.boolean(),
});

/**
 * Payload accepted by `POST /api/v2/leave/leave-entitlements`.
 */
export const CreateLeaveEntitlementRequestSchema = z.strictObject({
    empNumber: z.int(),
    leaveTypeId: z.int(),
    fromDate: z.string(),
    toDate: z.string(),
    entitlement: z.number().positive(),
});

/** `POST /api/v2/leave/leave-entitlements` -- single resource, `meta` is empty. */
export const LeaveEntitlementResponseSchema = z.strictObject({
    data: LeaveEntitlementSchema,
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

/**
 * Payload accepted by `POST /api/v2/leave/leave-requests`.
 *
 * Dates are ISO `yyyy-mm-dd` on the wire even though the UI renders and accepts
 * `yyyy-dd-mm` -- the client converts before sending.
 */
export const ApplyLeaveRequestSchema = z.strictObject({
    leaveTypeId: z.int(),
    fromDate: z.string(),
    toDate: z.string(),
    comment: z.string().optional(),
    duration: z.strictObject({ type: z.string() }),
});

/**
 * `POST /api/v2/leave/leave-requests` -- the created request.
 */
export const ApplyLeaveResponseSchema = z.strictObject({
    data: z.strictObject({
        id: z.int(),
        leaveType: z.strictObject({
            id: z.int(),
            name: z.string(),
            deleted: z.boolean(),
        }),
        dateApplied: z.string(),
    }),
    meta: z.strictObject({ empNumber: z.int() }),
    rels: z.array(z.unknown()),
});

/**
 * The supervisor assignment returned by
 * `POST /api/v2/pim/employees/{empNumber}/supervisors`.
 */
export const SupervisorResponseSchema = z.strictObject({
    data: z.strictObject({
        supervisor: z.strictObject({
            empNumber: z.int(),
            firstName: z.string(),
            lastName: z.string(),
            middleName: z.string(),
            terminationId: z.int().nullable(),
        }),
        reportingMethod: z.strictObject({
            id: z.int(),
            name: z.string(),
        }),
    }),
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

// Type exports
export type LeaveType = zOutput<typeof LeaveTypeSchema>;
export type LeaveTypeListResponse = zOutput<typeof LeaveTypeListResponseSchema>;
export type LeaveEntitlement = zOutput<typeof LeaveEntitlementSchema>;
export type CreateLeaveEntitlementRequest = zOutput<
    typeof CreateLeaveEntitlementRequestSchema
>;
export type LeaveEntitlementResponse = zOutput<
    typeof LeaveEntitlementResponseSchema
>;
export type ApplyLeaveRequest = zOutput<typeof ApplyLeaveRequestSchema>;
export type ApplyLeaveResponse = zOutput<typeof ApplyLeaveResponseSchema>;
export type SupervisorResponse = zOutput<typeof SupervisorResponseSchema>;
