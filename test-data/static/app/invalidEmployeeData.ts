export const INVALID_EMPLOYEE_DATA = [
    {
        description: 'missing first name',
        firstName: undefined,
        invalidKey: 'firstName',
    },
    {
        description: 'null first name',
        firstName: null,
        invalidKey: 'firstName',
    },
    {
        description: 'missing last name',
        lastName: undefined,
        invalidKey: 'lastName',
    },
    {
        description: 'null last name',
        lastName: null,
        invalidKey: 'lastName',
    },
    {
        description: 'too long employee id',
        employeeId: '94832947483',
        invalidKey: 'employeeId',
    },
    {
        description: 'employee id passed as number',
        employeeId: 13345,
        invalidKey: 'employeeId',
    },
] as const;
