import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    type Answer,
    type Card,
    type Group,
    commitMatches,
    isFlake,
    parseAnswer,
    parseCard,
    renderReport,
    score,
} from './score.ts';

const FLAKE =
    'tests/app/api/employeeSearch.spec.ts > api/v2/pim/employees GET > should combine the name and employee id filters with AND semantics';
const A1 = 'tests/app/api/leaveBalance.spec.ts > balance > first';
const A2 = 'tests/app/api/leaveBalance.spec.ts > balance > second';
const OTHER = 'tests/app/api/login.spec.ts > login > other';
const SHA = '0123456789abcdef0123456789abcdef01234567';
const BUILD = '1001';

function card(overrides: Partial<Card> = {}): Card {
    return {
        fault_id: 'f01',
        verdict: 'code change',
        commit: SHA,
        failing_build: { run_id: BUILD },
        failing_tests: [A1, A2],
        flake_tests: [],
        ...overrides,
    };
}

function group(overrides: Partial<Group> = {}): Group {
    return {
        tests: [A1, A2],
        verdict: 'code change',
        commit: SHA.slice(0, 7),
        ...overrides,
    };
}

function answer(groups: Group[], failingBuild: string = BUILD): Answer {
    return { failing_build: failingBuild, groups };
}

void describe('score: one fault', () => {
    void it('finds a fault whose group, verdict and commit prefix match', () => {
        const [result] = score([card()], [answer([group()])]).faults;
        assert.equal(result.found, true);
        assert.equal(result.reason, null);
    });

    void it('reports no answer when no answer has the failing build', () => {
        const [result] = score([card()], [answer([group()], '9999')]).faults;
        assert.equal(result.reason, 'no answer');
    });

    void it('reports tests split across groups', () => {
        const [result] = score(
            [card()],
            [answer([group({ tests: [A1] }), group({ tests: [A2] })])]
        ).faults;
        assert.equal(result.reason, 'tests split across groups');
        assert.match(result.detail, /groups 1, 2/);
    });

    void it('reports extra tests in the group', () => {
        const [result] = score(
            [card()],
            [answer([group({ tests: [A1, A2, OTHER] })])]
        ).faults;
        assert.equal(result.reason, 'extra tests in the group');
    });

    void it('counts the flake mixed into the fault group as extra tests', () => {
        const [result] = score(
            [card({ flake_tests: [FLAKE] })],
            [answer([group({ tests: [A1, A2, FLAKE] })])]
        ).faults;
        assert.equal(result.reason, 'extra tests in the group');
    });

    void it('reports tests missing when the group lacks some of them', () => {
        const [result] = score(
            [card()],
            [answer([group({ tests: [A1] })])]
        ).faults;
        assert.equal(result.reason, 'tests missing');
    });

    void it('reports tests missing when no group holds any of them', () => {
        const [result] = score(
            [card()],
            [answer([group({ tests: [OTHER] })])]
        ).faults;
        assert.equal(result.reason, 'tests missing');
    });

    void it('reports undetermined apart from a wrong verdict', () => {
        const [result] = score(
            [card()],
            [answer([group({ verdict: 'undetermined', commit: null })])]
        ).faults;
        assert.equal(result.reason, 'undetermined');
    });

    void it('reports a wrong verdict', () => {
        const [result] = score(
            [card()],
            [answer([group({ verdict: 'infra problem', commit: null })])]
        ).faults;
        assert.equal(result.reason, 'wrong verdict');
    });

    void it('reports a wrong commit', () => {
        const [result] = score(
            [card()],
            [answer([group({ commit: 'fedcba9876' })])]
        ).faults;
        assert.equal(result.reason, 'wrong commit');
    });

    void it('reports a missing commit on a code change as a wrong commit', () => {
        const [result] = score(
            [card()],
            [answer([group({ commit: null })])]
        ).faults;
        assert.equal(result.reason, 'wrong commit');
    });

    void it('ignores the commit for a verdict other than code change', () => {
        const [result] = score(
            [card({ verdict: 'test script problem', commit: null })],
            [answer([group({ verdict: 'test script problem', commit: null })])]
        ).faults;
        assert.equal(result.found, true);
    });

    void it('finds the fault beside the flake in its own group', () => {
        const [result] = score(
            [card({ flake_tests: [FLAKE] })],
            [
                answer([
                    group(),
                    group({
                        tests: [FLAKE],
                        verdict: 'test script problem',
                        commit: null,
                    }),
                ]),
            ]
        ).faults;
        assert.equal(result.found, true);
    });
});

void describe('score: commit prefixes', () => {
    void it('accepts a prefix of 7 or more characters', () => {
        assert.equal(commitMatches(SHA.slice(0, 7), SHA), true);
        assert.equal(commitMatches(SHA.toUpperCase(), SHA), true);
    });

    void it('refuses a prefix shorter than 7 characters', () => {
        assert.equal(commitMatches(SHA.slice(0, 6), SHA), false);
    });

    void it('refuses a different commit', () => {
        assert.equal(commitMatches('1123456', SHA), false);
    });
});

void describe('score: the known flake', () => {
    const flakeGroup = group({
        tests: [FLAKE],
        verdict: 'test script problem',
        commit: null,
    });

    void it('recognises the flake by spec and title', () => {
        assert.equal(isFlake(FLAKE), true);
        assert.equal(isFlake(A1), false);
        assert.equal(
            isFlake('tests/app/api/other.spec.ts > x > AND semantics'),
            false
        );
    });

    void it('accepts the flake as its own group with test script problem', () => {
        const result = score(
            [card({ flake_tests: [FLAKE] })],
            [answer([group(), flakeGroup])]
        );
        assert.equal(result.flakes.length, 1);
        assert.equal(result.flakes[0].found, true);
        assert.equal(result.faults.length, 1);
    });

    void it('reports the flake with a wrong verdict', () => {
        const [flake] = score(
            [card({ flake_tests: [FLAKE] })],
            [answer([group(), { ...flakeGroup, verdict: 'infra problem' }])]
        ).flakes;
        assert.equal(flake.reason, 'wrong verdict');
    });

    void it('reports the flake sharing a group with the fault', () => {
        const [flake] = score(
            [card({ flake_tests: [FLAKE] })],
            [answer([group({ tests: [A1, A2, FLAKE] })])]
        ).flakes;
        assert.equal(flake.reason, 'extra tests in the group');
    });

    void it('reports the flake missing when the card lists it and no group does', () => {
        const [flake] = score(
            [card({ flake_tests: [FLAKE] })],
            [answer([group()])]
        ).flakes;
        assert.equal(flake.reason, 'tests missing');
    });

    void it('has no flake row when the card lists no flake test', () => {
        assert.equal(score([card()], [answer([group()])]).flakes.length, 0);
    });

    void it('reads the flake from the card, not from the answer', () => {
        const result = score([card()], [answer([group(), flakeGroup])]);
        assert.equal(result.flakes.length, 0);
        assert.deepEqual(result.unexpectedTests, [
            { failingBuild: BUILD, test: FLAKE },
        ]);
    });
});

void describe('score: tests no card explains', () => {
    void it('lists an answered test that is in no card and is not a flake test of the card', () => {
        const result = score(
            [card({ flake_tests: [FLAKE] })],
            [answer([group(), group({ tests: [OTHER, FLAKE] })])]
        );
        assert.deepEqual(result.unexpectedTests, [
            { failingBuild: BUILD, test: OTHER },
        ]);
    });

    void it('lists an answer whose build has no card', () => {
        const result = score([card()], [answer([group()]), answer([], '2002')]);
        assert.deepEqual(result.answersWithoutCard, ['2002']);
    });

    void it('refuses two answers for one build', () => {
        assert.throws(
            () => score([card()], [answer([group()]), answer([group()])]),
            /Two answers/
        );
    });
});

void describe('renderReport', () => {
    void it('counts found, wrong, undetermined and no answer apart', () => {
        const cards = [
            card({ fault_id: 'f01', failing_build: { run_id: '1' } }),
            card({ fault_id: 'f02', failing_build: { run_id: '2' } }),
            card({ fault_id: 'f03', failing_build: { run_id: '3' } }),
            card({ fault_id: 'f04', failing_build: { run_id: '4' } }),
        ];
        const answers = [
            answer([group()], '1'),
            answer([group({ verdict: 'infra problem' })], '2'),
            answer([group({ verdict: 'undetermined' })], '3'),
        ];
        const report = renderReport(score(cards, answers));
        assert.match(
            report,
            /Faults: 4\. Found: 1\. Wrong: 1\. Undetermined: 1\. No answer: 1\./
        );
        assert.match(report, /\| f02 \| 2 \| not found \| wrong verdict \|/);
    });
});

void describe('parseCard and parseAnswer', () => {
    const rawCard = {
        fault_id: 'f01',
        kind: 'app_bug',
        verdict: 'code change',
        commit: SHA,
        passing_build: { run_id: 1000, ohrm_ref: 'x' },
        failing_build: { run_id: 1001, ohrm_ref: 'y' },
        failing_tests: [A1],
        flake_tests: [FLAKE],
        what: 'w',
        file: 'f',
    };

    void it('reads a card and turns its run id into a string', () => {
        assert.equal(parseCard(rawCard, 'c.json').failing_build.run_id, '1001');
    });

    void it('refuses a code change card without a commit', () => {
        assert.throws(
            () => parseCard({ ...rawCard, commit: null }, 'c.json'),
            /needs a commit/
        );
    });

    void it('reads the flake tests of a card', () => {
        assert.deepEqual(parseCard(rawCard, 'c.json').flake_tests, [FLAKE]);
        assert.deepEqual(
            parseCard({ ...rawCard, flake_tests: [] }, 'c.json').flake_tests,
            []
        );
    });

    void it('refuses the flake in failing_tests', () => {
        assert.throws(
            () =>
                parseCard({ ...rawCard, failing_tests: [A1, FLAKE] }, 'c.json'),
            /belongs in flake_tests/
        );
    });

    void it('refuses a test other than the flake in flake_tests', () => {
        assert.throws(
            () => parseCard({ ...rawCard, flake_tests: [A2] }, 'c.json'),
            /not the known flake/
        );
    });

    void it('refuses a card without flake_tests', () => {
        const { flake_tests: _omitted, ...withoutFlakes } = rawCard;
        assert.throws(
            () => parseCard(withoutFlakes, 'c.json'),
            /flake_tests is not a list/
        );
    });

    void it('refuses an unknown verdict', () => {
        assert.throws(
            () => parseCard({ ...rawCard, verdict: 'regression' }, 'c.json'),
            /verdict/
        );
    });

    void it('reads an answer group without a commit', () => {
        const parsed = parseAnswer(
            {
                failing_build: 1001,
                passing_build: 1000,
                groups: [
                    {
                        tests: [A1],
                        verdict: 'infra problem',
                        flake: false,
                        explanation: 'e',
                        evidence: ['x'],
                    },
                ],
            },
            'a.json'
        );
        assert.equal(parsed.groups[0].commit, null);
    });
});

void describe('command line', () => {
    const script = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'score.ts'
    );

    void it('scores the cards and answers in two folders and writes the report', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'score-'));
        const cardsDir = path.join(root, 'cards');
        const answersDir = path.join(root, 'answers');
        mkdirSync(cardsDir);
        mkdirSync(answersDir);
        writeFileSync(
            path.join(cardsDir, 'f01.json'),
            JSON.stringify({
                fault_id: 'f01',
                verdict: 'code change',
                commit: SHA,
                failing_build: { run_id: 1001 },
                failing_tests: [A1],
                flake_tests: [],
            })
        );
        writeFileSync(
            path.join(answersDir, '1001.json'),
            JSON.stringify({
                failing_build: 1001,
                passing_build: 1000,
                groups: [{ tests: [A1], verdict: 'code change', commit: SHA }],
            })
        );
        const output = path.join(root, 'score.md');
        const run = spawnSync(
            process.execPath,
            [script, cardsDir, answersDir, output],
            { encoding: 'utf8' }
        );
        assert.equal(run.status, 0, run.stderr);
        assert.match(run.stdout, /Found: 1\./);
        assert.equal(readFileSync(output, 'utf8'), run.stdout);
    });

    void it('exits 2 with a usage line when a folder is missing', () => {
        const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
        assert.equal(run.status, 2);
        assert.match(run.stderr, /Usage/);
    });
});
