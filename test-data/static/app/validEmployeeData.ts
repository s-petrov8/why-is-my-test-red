export const VALID_EMPLOYEE_DATA = [
    {
        description: 'complete data',
        overrides: {},
        expected: {},
    },
    {
        description: 'missing middle name',
        overrides: { middleName: undefined },
        expected: { middleName: '' },
    },
    {
        description: 'missing employeeId',
        overrides: { employeeId: undefined },
        expected: { employeeId: null },
    },
] as const;
