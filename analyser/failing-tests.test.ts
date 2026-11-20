import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    type Report,
    failingTestIds,
    parseReport,
    testId,
} from './failing-tests.ts';

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

void describe('parseReport', () => {
    const raw = {
        config: {
            rootDir: `${ROOT}/tests`,
            configFile: `${ROOT}/playwright.config.ts`,
            workers: 1,
        },
        suites: [
            {
                title: 'e.spec.ts',
                file: 'e.spec.ts',
                specs: [
                    {
                        title: 'fails',
                        file: 'e.spec.ts',
                        line: 3,
                        tests: [
                            {
                                status: 'unexpected',
                                projectName: 'chromium',
                                results: [{ status: 'failed', duration: 5 }],
                            },
                        ],
                    },
                ],
            },
        ],
        errors: [],
        stats: { expected: 0 },
    };

    void it('reads the fields the lister needs and drops the rest', () => {
        const report = parseReport(raw);
        assert.deepEqual(failingTestIds(report), ['tests/e.spec.ts > fails']);
        assert.equal('stats' in report, false);
    });

    void it('names the field when a spec has no title', () => {
        const broken = structuredClone(raw);
        const [spec] = broken.suites[0].specs;
        assert.throws(
            () =>
                parseReport({
                    ...broken,
                    suites: [
                        {
                            ...broken.suites[0],
                            specs: [{ ...spec, title: undefined }],
                        },
                    ],
                }),
            /report\.suites\[0\]\.specs\[0\]\.title is not a string/
        );
    });

    void it('refuses a report that is not an object', () => {
        assert.throws(() => parseReport([]), /report is not an object/);
    });

    void it('makes the command exit 2 with the reason on a malformed report', () => {
        const file = path.join(
            mkdtempSync(path.join(tmpdir(), 'failing-tests-')),
            'results.json'
        );
        writeFileSync(file, JSON.stringify({ suites: 'none' }));
        const script = path.join(
            path.dirname(fileURLToPath(import.meta.url)),
            'failing-tests.ts'
        );
        const run = spawnSync(process.execPath, [script, file], {
            encoding: 'utf8',
        });
        assert.equal(run.status, 2);
        assert.match(run.stderr, /report\.suites is not a list/);
    });
});
