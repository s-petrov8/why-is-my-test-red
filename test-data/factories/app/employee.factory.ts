import { faker } from '@faker-js/faker';
import {
    CreateEmployeeRequest,
    CreateEmployeeRequestSchema,
} from '../../../fixtures/api/schemas/app/employeeSchema';

/**
 * Generates a valid employee creation payload with randomized data using Faker.
 * The generated data conforms to the CreateEmployeeRequestSchema structure.
 *
 * @param {Partial<CreateEmployeeRequest>} overrides - Optional partial employee object to override generated values.
 * @returns {CreateEmployeeRequest} A valid payload matching the CreateEmployeeRequestSchema.
 *
 * @example
 * ```ts
 * const employee = createEmployeeData();
 * const withFixedId = createEmployeeData({ employeeId: '12345678' });
 * ```
 */
export const createEmployeeData = (
    overrides?: Partial<CreateEmployeeRequest>
): CreateEmployeeRequest => {
    const defaultEmployee: CreateEmployeeRequest = {
        firstName: faker.person.firstName(),
        middleName: faker.person.middleName(),
        lastName: faker.person.lastName(),
        employeeId: faker.string.numeric(8),
    };

    const mergedEmployee = { ...defaultEmployee, ...overrides };

    return CreateEmployeeRequestSchema.parse(mergedEmployee);
};
