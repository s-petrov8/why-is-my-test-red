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
