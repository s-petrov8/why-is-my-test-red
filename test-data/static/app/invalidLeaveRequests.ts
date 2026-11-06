/**
 * Invalid values for `POST /api/v2/leave/leave-requests`, each answered with a
 * 422 naming `field`. Type mismatches come from `test-data/static/util/invalid-values.ts`.
 */

/** Fields the application refuses a request without. */
export const REQUIRED_LEAVE_REQUEST_FIELDS = [
    'leaveTypeId',
    'fromDate',
    'toDate',
] as const;

export const INVALID_LEAVE_REQUEST_VALUES = [
    {
        description: 'a from date that is no date',
        field: 'fromDate',
        value: 'not-a-date',
    },
    {
        description: 'a to date that is no date',
        field: 'toDate',
        value: 'not-a-date',
    },
    { description: 'a numeric comment', field: 'comment', value: 123 },
    {
        description: 'a duration that is no object',
        field: 'duration',
        value: 'full_day',
    },
    {
        description: 'an unknown duration type',
        field: 'duration',
        value: { type: 'invalidValue' },
    },
    {
        description: 'a timed duration without times',
        field: 'duration',
        value: { type: 'specify_time' },
    },
    {
        description: 'a timed duration ending before it starts',
        field: 'duration',
        value: { type: 'specify_time', fromTime: '11:00', toTime: '09:00' },
    },
    {
        description: 'an unknown partial option',
        field: 'partialOption',
        value: 'invalidValue',
    },
    {
        description: 'an unexpected field',
        field: 'unexpectedField',
        value: 'invalidValue',
    },
] as const;
