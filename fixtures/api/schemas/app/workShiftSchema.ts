import { z } from 'zod/v4';
import type { output as zOutput } from 'zod/v4';

/** Schemas for the work shift endpoints (`/api/v2/admin/work-shifts`). */

/** Payload accepted by `POST /api/v2/admin/work-shifts`. `hoursPerDay` is a string on the wire. */
export const CreateWorkShiftRequestSchema = z.strictObject({
    name: z.string(),
    hoursPerDay: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    empNumbers: z.array(z.int()),
});

/** `POST /api/v2/admin/work-shifts`. */
export const WorkShiftResponseSchema = z.strictObject({
    data: z.strictObject({
        id: z.int(),
        name: z.string(),
        hoursPerDay: z.number(),
        startTime: z.string(),
        endTime: z.string(),
    }),
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

/** `DELETE /api/v2/admin/work-shifts`: the ids that were deleted. */
export const DeleteWorkShiftsResponseSchema = z.strictObject({
    data: z.array(z.int()),
    meta: z.array(z.unknown()),
    rels: z.array(z.unknown()),
});

// Type exports
export type CreateWorkShiftRequest = zOutput<
    typeof CreateWorkShiftRequestSchema
>;
export type WorkShiftResponse = zOutput<typeof WorkShiftResponseSchema>;
