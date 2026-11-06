export function formatDate(value: number | string): string {
    return new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Pads a date part to the two digits every date format below expects.
 *
 * @param {number} value - The month or day number.
 * @returns {string} The value as a zero-padded two-character string.
 */
function padDatePart(value: number): string {
    return String(value).padStart(2, '0');
}

/**
 * Formats a date the way a fresh install's date INPUTS render and accept it:
 * `yyyy-mm-dd`.
 *
 * @param {Date} date - The date to format.
 * @returns {string} The date as `yyyy-mm-dd`.
 *
 * @example
 * ```ts
 * formatAppDate(new Date(2026, 8, 21)); // '2026-09-21' -- 21 September 2026
 * ```
 */
export function formatAppDate(date: Date): string {
    const year = date.getFullYear();
    const month = padDatePart(date.getMonth() + 1);
    const day = padDatePart(date.getDate());

    return `${year}-${month}-${day}`;
}

/**
 * Formats a date as ISO `yyyy-mm-dd`, the shape the `/api/v2` endpoints expect.
 *
 * @param {Date} date - The date to format.
 * @returns {string} The date as `yyyy-mm-dd`.
 *
 * @example
 * ```ts
 * formatIsoDate(new Date(2026, 8, 21)); // '2026-09-21'
 * ```
 */
export function formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = padDatePart(date.getMonth() + 1);
    const day = padDatePart(date.getDate());

    return `${year}-${month}-${day}`;
}

/**
 * Returns a date `daysAhead` days from today, moved forward off a weekend.
 *
 * Weekends matter: the application counts a Saturday or Sunday as `0.00` days of
 * leave, so a request landing on one consumes no balance and reports a duration
 * of zero -- a confusing pass rather than an honest one.
 *
 * @param {number} daysAhead - How many days ahead to start from.
 * @returns {Date} A weekday at least `daysAhead` days from today.
 *
 * @example
 * ```ts
 * const leaveDate = getFutureWeekday(14);
 * ```
 */
export function getFutureWeekday(daysAhead: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);

    const SATURDAY = 6;
    const SUNDAY = 0;

    while (date.getDay() === SATURDAY || date.getDay() === SUNDAY) {
        date.setDate(date.getDate() + 1);
    }

    return date;
}

/**
 * Returns the leave period containing `date`, as ISO dates.
 *
 * The application runs a January-to-December leave period, and an entitlement is
 * only usable by leave that falls inside the same period. Deriving the period
 * from the leave date -- rather than hardcoding the current year -- keeps a run
 * late in December, whose leave date rolls into January, from granting the
 * entitlement against the wrong year.
 *
 * Dates are returned rather than formatted strings because the two consumers
 * need different shapes of the same period: the entitlement API takes
 * {@link formatIsoDate} and the Leave List filter takes {@link formatAppDate}.
 *
 * @param {Date} date - A date inside the wanted leave period.
 * @returns {{ fromDate: Date, toDate: Date }} First and last day of the period.
 *
 * @example
 * ```ts
 * const { fromDate, toDate } = getLeavePeriod(new Date(2026, 8, 21));
 * // 1 January 2026 .. 31 December 2026
 * ```
 */
export function getLeavePeriod(date: Date): {
    fromDate: Date;
    toDate: Date;
} {
    const year = date.getFullYear();
    const DECEMBER = 11;
    const LAST_DAY_OF_DECEMBER = 31;

    return {
        fromDate: new Date(year, 0, 1),
        toDate: new Date(year, DECEMBER, LAST_DAY_OF_DECEMBER),
    };
}

/** Days from one Monday to the next. */
const DAYS_PER_WEEK = 7;

/** How far ahead leave is booked by default, keeping it well clear of today. */
const LEAVE_WEEK_MIN_DAYS_AHEAD = 7;

/** One Monday-to-Monday stretch, for leave that spans named weekdays. */
export type LeaveWeek = {
    monday: Date;
    tuesday: Date;
    wednesday: Date;
    thursday: Date;
    friday: Date;
    saturday: Date;
    sunday: Date;
    nextMonday: Date;
};

/**
 * Returns a date some days away from another, without changing the original.
 *
 * @param {Date} date - The starting date.
 * @param {number} days - Days to add; negative to go back.
 * @returns {Date} The new date.
 */
export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);

    return result;
}

/**
 * Moves a date forward to the Monday on or after it.
 *
 * @param {Date} date - The starting date.
 * @returns {Date} That Monday.
 */
function toMonday(date: Date): Date {
    const MONDAY = 1;

    return addDays(
        date,
        (DAYS_PER_WEEK + MONDAY - date.getDay()) % DAYS_PER_WEEK
    );
}

/**
 * Names the days of the week starting on a Monday.
 *
 * @param {Date} monday - The Monday.
 * @returns {LeaveWeek} The week's days.
 */
function buildLeaveWeek(monday: Date): LeaveWeek {
    const [tuesday, wednesday, thursday, friday, saturday, sunday] = [
        1, 2, 3, 4, 5, 6,
    ].map((offset): Date => addDays(monday, offset));

    return {
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
        sunday,
        nextMonday: addDays(monday, DAYS_PER_WEEK),
    };
}

/**
 * Returns a future week wholly inside one calendar year, so one leave period's
 * entitlement covers every day of it on any date the suite runs.
 *
 * @param {number} [minDaysAhead] - The fewest days from today its Monday may be.
 * @returns {LeaveWeek} The week.
 *
 * @example
 * ```ts
 * const { friday, nextMonday } = getLeaveWeek();
 * ```
 */
export function getLeaveWeek(
    minDaysAhead: number = LEAVE_WEEK_MIN_DAYS_AHEAD
): LeaveWeek {
    const monday = toMonday(addDays(new Date(), minDaysAhead));

    if (addDays(monday, DAYS_PER_WEEK).getFullYear() === monday.getFullYear()) {
        return buildLeaveWeek(monday);
    }

    return buildLeaveWeek(toMonday(new Date(monday.getFullYear() + 1, 0, 1)));
}

/**
 * Returns a week in June of next year, which no other leave test books.
 *
 * @param {number} weekIndex - Which week of the month, counted from zero.
 * @returns {LeaveWeek} The week.
 */
export function getNextJuneWeek(weekIndex: number): LeaveWeek {
    const JUNE = 5;
    const firstMonday = toMonday(
        new Date(new Date().getFullYear() + 1, JUNE, 1)
    );

    return buildLeaveWeek(addDays(firstMonday, weekIndex * DAYS_PER_WEEK));
}

/**
 * Returns a past weekday, moved further back off a weekend.
 *
 * @param {number} daysBack - The fewest days before today it may be.
 * @returns {Date} The weekday.
 */
export function getPastWeekday(daysBack: number): Date {
    const SATURDAY = 6;
    const SUNDAY = 0;
    let date = addDays(new Date(), -daysBack);

    while (date.getDay() === SATURDAY || date.getDay() === SUNDAY) {
        date = addDays(date, -1);
    }

    return date;
}

/**
 * Says whether a date is in the same leave period as today. A fresh instance has no
 * leave period before the year it was set up in.
 *
 * @param {Date} date - The date.
 * @returns {boolean} Whether it falls in today's leave period.
 */
export function isInCurrentLeavePeriod(date: Date): boolean {
    return date.getFullYear() === new Date().getFullYear();
}

/**
 * Formats a number of days the way the leave screens render it.
 *
 * @param {number} days - The number of days.
 * @returns {string} The days to two decimal places.
 */
export function formatLeaveDays(days: number): string {
    return days.toFixed(2);
}
