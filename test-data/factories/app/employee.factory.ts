import { faker } from '@faker-js/faker';
import { TerminationReasonIds } from '../../../enums/app/app';
import {
    CreateEmployeeRequest,
    CreateEmployeeRequestSchema,
    CreateTerminationRequest,
    CreateTerminationRequestSchema,
} from '../../../fixtures/api/schemas/app/employeeSchema';
import { formatIsoDate } from '../../../helpers/util/util';

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

/**
 * Generates a valid termination payload, dated within the past year.
 *
 * @param {Partial<CreateTerminationRequest>} overrides - Optional values to override generated ones.
 * @returns {CreateTerminationRequest} A valid payload matching the CreateTerminationRequestSchema.
 *
 * @example
 * ```ts
 * const termination = createTerminationData();
 * ```
 */
export const createTerminationData = (
    overrides?: Partial<CreateTerminationRequest>
): CreateTerminationRequest => {
    const defaultTermination: CreateTerminationRequest = {
        terminationReasonId: TerminationReasonIds.OTHER,
        date: formatIsoDate(faker.date.past()),
        note: faker.lorem.sentence(),
    };

    return CreateTerminationRequestSchema.parse({
        ...defaultTermination,
        ...overrides,
    });
};
