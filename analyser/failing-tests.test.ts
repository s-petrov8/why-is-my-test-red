import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { type Report, failingTestIds, testId } from './failing-tests.ts';

const ROOT = '/home/runner/work/repo/repo';

function report(suites: Report['suites']): Report {
    return {
        config: {
            rootDir: `${ROOT}/tests`,
            configFile: `${ROOT}/playwright.config.ts`,
        },
        suites,
        errors: [],
    };
}

function spec(
    title: string,
    file: string,
    outcomes: { status: string; result: string }[]
): NonNullable<NonNullable<Report['suites']>[number]['specs']>[number] {
    return {
        title,
        file,
        tests: outcomes.map(({ status, result }) => ({
            status,
            results: [{ status: result }],
        })),
    };
}

void describe('testId', () => {
    void it('joins spec path, describe titles and test title with " > "', () => {
        assert.equal(
            testId('tests/a.spec.ts', ['outer', 'inner'], 'does a thing'),
            'tests/a.spec.ts > outer > inner > does a thing'
        );
    });
});

void describe('failingTestIds', () => {
    void it('lists failed and timed-out tests with their path from the repo root', () => {
        const ids = failingTestIds(
            report([
                {
                    title: 'app/api/a.spec.ts',
                    suites: [
                        {
                            title: 'outer',
                            specs: [
                                spec('fails', 'app/api/a.spec.ts', [
                                    { status: 'unexpected', result: 'failed' },
                                ]),
                                spec('passes', 'app/api/a.spec.ts', [
                                    { status: 'expected', result: 'passed' },
                                ]),
                            ],
                            suites: [
                                {
                                    title: 'inner',
                                    specs: [
                                        spec('times out', 'app/api/a.spec.ts', [
                                            {
                                                status: 'unexpected',
                                                result: 'timedOut',
                                            },
                                        ]),
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ])
        );
        assert.deepEqual(ids, [
            'tests/app/api/a.spec.ts > outer > fails',
            'tests/app/api/a.spec.ts > outer > inner > times out',
        ]);
    });

    void it('gives a test outside any describe the spec path and title only', () => {
        const ids = failingTestIds(
            report([
                {
                    title: 'app/b.setup.ts',
                    specs: [
                        spec('seeds', 'app/b.setup.ts', [
                            { status: 'unexpected', result: 'failed' },
                        ]),
                    ],
                },
            ])
        );
        assert.deepEqual(ids, ['tests/app/b.setup.ts > seeds']);
    });

    void it('lists a test once when it fails in two projects', () => {
        const ids = failingTestIds(
            report([
                {
                    title: 'c.spec.ts',
                    specs: [
                        spec('twice', 'c.spec.ts', [
                            { status: 'unexpected', result: 'failed' },
                            { status: 'unexpected', result: 'failed' },
                        ]),
                    ],
                },
            ])
        );
        assert.deepEqual(ids, ['tests/c.spec.ts > twice']);
    });

    void it('leaves out skipped and interrupted tests', () => {
        const ids = failingTestIds(
            report([
                {
                    title: 'd.spec.ts',
                    specs: [
                        spec('skipped', 'd.spec.ts', [
                            { status: 'skipped', result: 'skipped' },
                        ]),
                        spec('interrupted', 'd.spec.ts', [
                            { status: 'unexpected', result: 'interrupted' },
                        ]),
                    ],
                },
            ])
        );
        assert.deepEqual(ids, []);
    });

    void it('refuses a report without the config paths', () => {
        assert.throws(() => failingTestIds({ suites: [] }), /rootDir/);
    });
});
