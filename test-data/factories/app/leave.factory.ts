import { faker } from '@faker-js/faker';
import { HolidayLengths, LeaveDurationTypes } from '../../../enums/app/app';
import {
    ApplyLeaveRequest,
    ApplyLeaveRequestSchema,
    CreateHolidayRequest,
    CreateHolidayRequestSchema,
} from '../../../fixtures/api/schemas/app/leaveSchema';
import {
    CreateWorkShiftRequest,
    CreateWorkShiftRequestSchema,
} from '../../../fixtures/api/schemas/app/workShiftSchema';
import { formatIsoDate } from '../../../helpers/util/util';

/**
 * Generates a leave type's name. The prefix sorts after `Annual Leave`, because
 * `resolveLeaveType` picks the first non-situational type by name.
 *
 * @returns {string} A unique name.
 */
export const createLeaveTypeName = (): string =>
    `Zz ${faker.commerce.productAdjective()} ${faker.string.alphanumeric(10)}`;

/**
 * Generates a leave request for a date range, a single full day by default.
 *
 * @param {object} leave - What is being requested.
 * @param {number} leave.leaveTypeId - The leave type.
 * @param {Date} leave.fromDate - First day of leave.
 * @param {Date} [leave.toDate] - Last day of leave. Defaults to `fromDate`.
 * @param {Partial<ApplyLeaveRequest>} [overrides] - Values to override.
 * @returns {ApplyLeaveRequest} A payload matching ApplyLeaveRequestSchema.
 */
export const createLeaveRequestData = (
    leave: { leaveTypeId: number; fromDate: Date; toDate?: Date },
    overrides?: Partial<ApplyLeaveRequest>
): ApplyLeaveRequest =>
    ApplyLeaveRequestSchema.parse({
        leaveTypeId: leave.leaveTypeId,
        fromDate: formatIsoDate(leave.fromDate),
        toDate: formatIsoDate(leave.toDate ?? leave.fromDate),
        duration: { type: LeaveDurationTypes.FULL_DAY },
        ...overrides,
    });

/**
 * Generates a non-recurring full holiday.
 *
 * @param {Date} date - The holiday's date.
 * @param {Partial<CreateHolidayRequest>} [overrides] - Values to override.
 * @returns {CreateHolidayRequest} A payload matching CreateHolidayRequestSchema.
 */
export const createHolidayData = (
    date: Date,
    overrides?: Partial<CreateHolidayRequest>
): CreateHolidayRequest =>
    CreateHolidayRequestSchema.parse({
        name: `Holiday ${faker.string.alphanumeric(10)}`,
        date: formatIsoDate(date),
        recurring: false,
        length: HolidayLengths.FULL_DAY,
        ...overrides,
    });

/**
 * Generates a work shift for some employees.
 *
 * @param {object} shift - What the shift needs.
 * @param {number[]} shift.empNumbers - The employees on it.
 * @param {object} shift.hours - Its length and times.
 * @param {string} shift.hours.hoursPerDay - Its length in hours.
 * @param {string} shift.hours.startTime - Its start, as `hh:mm`.
 * @param {string} shift.hours.endTime - Its end, as `hh:mm`.
 * @returns {CreateWorkShiftRequest} A payload matching CreateWorkShiftRequestSchema.
 */
export const createWorkShiftData = (shift: {
    empNumbers: number[];
    hours: { hoursPerDay: string; startTime: string; endTime: string };
}): CreateWorkShiftRequest =>
    CreateWorkShiftRequestSchema.parse({
        name: `Shift ${faker.string.alphanumeric(10)}`,
        empNumbers: shift.empNumbers,
        ...shift.hours,
    });

/**
 * Generates a comment on a leave request, short enough for the leave lists to show
 * it whole: they cut a comment off after 50 characters.
 *
 * @returns {string} The comment.
 */
export const createLeaveComment = (): string =>
    `Comment ${faker.string.alphanumeric(20)}`;
