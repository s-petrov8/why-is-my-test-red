import { z } from 'zod/v4';
import type { output as zOutput } from 'zod/v4';
import {
    HolidayLengths,
    LeaveActions,
    LeaveDurationTypes,
} from '../../../../enums/app/app';
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

/** `POST`, `GET /api/v2/leave/leave-types/{id}` -- single resource, `meta` is empty. */
export const LeaveTypeResponseSchema = z.strictObject({
    data: LeaveTypeSchema,
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

/** `GET /api/v2/leave/leave-types/eligible` -- the types the caller can apply for. */
export const EligibleLeaveTypesResponseSchema = z.strictObject({
    data: z.array(LeaveTypeSchema),
    meta: z.strictObject({ empNumber: z.int() }),
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

/** `GET /api/v2/leave/leave-entitlements/{id}` -- `meta` names the employee. */
export const LeaveEntitlementReadResponseSchema = z.strictObject({
    data: LeaveEntitlementSchema,
    meta: z.strictObject({ empNumber: z.int() }),
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
    duration: z.strictObject({
        type: z.enum(LeaveDurationTypes),
        fromTime: z.string().optional(),
        toTime: z.string().optional(),
    }),
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

/** The leave type as a leave request carries it. */
const LeaveRequestTypeSchema = z.strictObject({
    id: z.int(),
    name: z.string(),
    deleted: z.boolean(),
});

/** `GET`, `PUT` on one leave request, without `model=detailed`. */
export const LeaveRequestResponseSchema = z.strictObject({
    data: z.strictObject({
        id: z.int(),
        leaveType: LeaveRequestTypeSchema,
        dateApplied: z.string(),
    }),
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

/** The six numbers of a balance: `balance = entitled - used`, `used = scheduled + pending + taken`. */
export const LeaveBalanceSchema = z.strictObject({
    entitled: z.number(),
    used: z.number(),
    scheduled: z.number(),
    pending: z.number(),
    taken: z.number(),
    balance: z.number(),
    asAtDate: z.string(),
    endDate: z.string(),
});

/** One leave period's balance. */
const LeavePeriodBalanceSchema = z.strictObject({
    period: z.strictObject({ startDate: z.string(), endDate: z.string() }),
    balance: LeaveBalanceSchema,
});

/** `GET /api/v2/leave/leave-balance/leave-type/{id}` with `fromDate` and `toDate`. */
export const LeaveBalanceBreakdownResponseSchema = z.strictObject({
    data: z.strictObject({
        negative: z.boolean(),
        breakdown: z.array(
            z.strictObject({
                ...LeavePeriodBalanceSchema.shape,
                leaves: z.array(
                    z.strictObject({
                        balance: z.number(),
                        date: z.string(),
                        length: z.number(),
                        status: z.null(),
                    })
                ),
            })
        ),
    }),
    meta: z.strictObject({
        employee: EmployeeSchema,
        leaveType: LeaveTypeSchema,
    }),
    rels: z.array(z.unknown()),
});

/** An action the caller may take. */
const LeaveAllowedActionSchema = z.strictObject({
    action: z.enum(LeaveActions),
    name: z.string(),
});

/** The dates of a request or of one day. A single day has a null `toDate`. */
const LeaveDatesSchema = z.strictObject({
    fromDate: z.string(),
    toDate: z.string().nullable(),
    durationType: z.strictObject({
        id: z.int().nullable(),
        type: z.string().nullable(),
    }),
    startTime: z.string().nullable(),
    endTime: z.string().nullable(),
});

/** The most recent comment. */
const LeaveLastCommentSchema = z.strictObject({
    id: z.int(),
    comment: z.string(),
    date: z.string(),
    time: z.string(),
});

/** A leave request with `model=detailed`, as the caller's role sees it. */
export const DetailedLeaveRequestSchema = z.strictObject({
    id: z.int(),
    dates: LeaveDatesSchema,
    noOfDays: z.number(),
    leaveBalances: z.array(LeavePeriodBalanceSchema),
    multiPeriod: z.boolean(),
    leaveBreakdown: z.array(
        z.strictObject({
            id: z.int(),
            name: z.string(),
            lengthDays: z.number(),
        })
    ),
    allowedActions: z.array(LeaveAllowedActionSchema),
    hasMultipleStatus: z.boolean(),
    employee: EmployeeSchema,
    leaveType: LeaveRequestTypeSchema,
    lastComment: LeaveLastCommentSchema.nullable(),
});

/** `GET` on one leave request with `model=detailed`. */
export const DetailedLeaveRequestResponseSchema = z.strictObject({
    data: DetailedLeaveRequestSchema,
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

/** `GET /api/v2/leave/leave-requests` -- the caller's own, in every status. */
export const MyLeaveRequestListResponseSchema = z.strictObject({
    data: z.array(DetailedLeaveRequestSchema),
    meta: z.strictObject({ empNumber: z.int(), total: z.int() }),
    rels: z.array(z.unknown()),
});

/** `GET /api/v2/leave/leave-requests/{id}/leaves` -- one row per day, weekends included. */
export const LeaveDayListResponseSchema = z.strictObject({
    data: z.array(
        z.strictObject({
            id: z.int(),
            dates: LeaveDatesSchema,
            lengthHours: z.number(),
            leaveBalance: LeavePeriodBalanceSchema,
            leaveStatus: z.strictObject({
                id: z.int(),
                name: z.string(),
                lengthDays: z.number(),
            }),
            allowedActions: z.array(LeaveAllowedActionSchema),
            leaveType: LeaveRequestTypeSchema,
            lastComment: LeaveLastCommentSchema.nullable(),
        })
    ),
    meta: z.strictObject({
        total: z.int(),
        employee: EmployeeSchema,
        startDate: z.string(),
        endDate: z.string(),
    }),
    rels: z.array(z.unknown()),
});

/** `PUT /api/v2/leave/leaves/{id}` -- the changed day. */
export const LeaveDayResponseSchema = z.strictObject({
    data: z.strictObject({
        id: z.int(),
        date: z.string(),
        lengthHours: z.number(),
        lengthDays: z.number(),
        status: z.strictObject({ id: z.int(), name: z.string() }),
        leaveRequest: z.strictObject({ id: z.int() }),
        leaveType: LeaveRequestTypeSchema,
        startTime: z.string().nullable(),
        endTime: z.string().nullable(),
        durationType: z.strictObject({ id: z.int(), type: z.string() }),
        lastComment: z.strictObject({
            id: z.int().nullable(),
            comment: z.string().nullable(),
            date: z.string().nullable(),
            time: z.string().nullable(),
        }),
    }),
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

/** A holiday. `length` is `HolidayLengths`. */
export const HolidaySchema = z.strictObject({
    id: z.int(),
    name: z.string(),
    date: z.string(),
    recurring: z.boolean(),
    length: z.int(),
    lengthName: z.string(),
});

/** Payload accepted by `POST /api/v2/leave/holidays`. */
export const CreateHolidayRequestSchema = z.strictObject({
    name: z.string(),
    date: z.string(),
    recurring: z.boolean(),
    length: z.enum(HolidayLengths),
});

/** `POST /api/v2/leave/holidays`. */
export const HolidayResponseSchema = z.strictObject({
    data: HolidaySchema,
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

/** The length of each weekday: `WorkWeekDayLengths`. */
export const WorkWeekSchema = z.strictObject({
    monday: z.int(),
    tuesday: z.int(),
    wednesday: z.int(),
    thursday: z.int(),
    friday: z.int(),
    saturday: z.int(),
    sunday: z.int(),
});

/** `GET`, `PUT /api/v2/leave/workweek`. */
export const WorkWeekResponseSchema = z.strictObject({
    data: WorkWeekSchema,
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

/** `DELETE` on the leave collections: the ids that were deleted. */
export const DeleteLeaveRecordsResponseSchema = z.strictObject({
    data: z.array(z.int()),
    meta: z.array(z.unknown()),
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
export type LeaveBalance = zOutput<typeof LeaveBalanceSchema>;
export type DetailedLeaveRequest = zOutput<typeof DetailedLeaveRequestSchema>;
export type LeaveDayList = zOutput<typeof LeaveDayListResponseSchema>['data'];
export type Holiday = zOutput<typeof HolidaySchema>;
export type CreateHolidayRequest = zOutput<typeof CreateHolidayRequestSchema>;
export type WorkWeek = zOutput<typeof WorkWeekSchema>;
export type SupervisorResponse = zOutput<typeof SupervisorResponseSchema>;
