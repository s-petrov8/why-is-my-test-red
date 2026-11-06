/**
 * Every entry produces `422 Invalid Parameter` with the offending parameter named
 * in `error.data.invalidParamKeys`, so one assertion shape covers the whole set.
 * Verified against the live application.
 *
 * Scope: the name and employee-id filters only. `limit`, `offset`, `sortField`,
 * `sortOrder`, `model` and `includeEmployees` are also validated by the endpoint
 * (e.g. `limit=abc` and `limit=-1` both answer 422) but are out of scope here.
 *
 * Notable: the endpoint rejects UNKNOWN parameters rather than ignoring them, and
 * `firstName` / `lastName` are not supported filters -- only `name`, `nameOrId`
 * and `employeeId` are.
 *
 * Format: `.ts` with `as const` exports, literal values only -- no runtime
 * imports, no functions, no computed values.
 */

/**
 * `name` at 128 characters. The limit lies between 100 (accepted) and 128
 * (rejected); the exact boundary is not yet pinned.
 */
const NAME_OVER_LENGTH_LIMIT =
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

export const INVALID_EMPLOYEE_SEARCH = [
    {
        description: 'an unknown query parameter',
        param: 'bogus',
        value: '1',
        invalidKey: 'bogus',
    },
    {
        description: 'an empty name',
        param: 'name',
        value: '',
        invalidKey: 'name',
    },
    {
        description: 'an empty employee id',
        param: 'employeeId',
        value: '',
        invalidKey: 'employeeId',
    },
    {
        description: 'firstName, which is not a supported filter',
        param: 'firstName',
        value: 'Ada',
        invalidKey: 'firstName',
    },
    {
        description: 'lastName, which is not a supported filter',
        param: 'lastName',
        value: 'Lovelace',
        invalidKey: 'lastName',
    },
    {
        description: 'a name over the length limit',
        param: 'name',
        value: NAME_OVER_LENGTH_LIMIT,
        invalidKey: 'name',
    },
] as const;

export const NO_MATCH_EMPLOYEE_NAME = 'Zzqqxx Notreal' as const;
