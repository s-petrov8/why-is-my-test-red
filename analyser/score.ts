/**
 * Scores analyser answers against answer cards, with no AI involved, so the
 * same answers always get the same score. The rules are in analyser/README.md.
 *
 * Usage: node analyser/score.ts <cards-dir> <answers-dir> [output.md]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ID_SEPARATOR } from './failing-tests.ts';

export const VERDICTS = [
    'code change',
    'test script problem',
    'infra problem',
    'undetermined',
] as const;
export type Verdict = (typeof VERDICTS)[number];

/** The suite's known intermittent failure, which has a fixed answer. */
export const FLAKE_SPEC = 'tests/app/api/employeeSearch.spec.ts';
export const FLAKE_TITLE_PART = 'AND semantics';
export const FLAKE_VERDICT: Verdict = 'test script problem';

/** Shortest commit prefix the scorer accepts. */
export const MIN_COMMIT_PREFIX = 7;

export interface Card {
    fault_id: string;
    verdict: Verdict;
    commit: string | null;
    failing_build: { run_id: string };
    failing_tests: string[];
    flake_tests: string[];
}

export interface Leaning {
    verdict: Verdict;
    commit: string | null;
}

export interface LastPassed {
    run_id: string;
    ohrm_sha: string | null;
    test_sha: string | null;
}

export interface Group {
    tests: string[];
    verdict: Verdict;
    commit: string | null;
    confidence: number;
    leaning: Leaning | null;
    last_passed: LastPassed | null;
}

export interface Answer {
    failing_build: string;
    groups: Group[];
}

export type Reason =
    | 'no answer'
    | 'tests split across groups'
    | 'tests missing'
    | 'extra tests in the group'
    | 'undetermined'
    | 'wrong verdict'
    | 'wrong commit';

export interface Judgement {
    found: boolean;
    reason: Reason | null;
    detail: string;
}

export interface FaultResult extends Judgement {
    faultId: string;
    failingBuild: string;
    /** The answer groups that hold any of the fault's tests. */
    groups: Group[];
}

export interface FlakeResult extends Judgement {
    failingBuild: string;
}

export interface UnexpectedTest {
    failingBuild: string;
    test: string;
}

export interface Score {
    faults: FaultResult[];
    flakes: FlakeResult[];
    unexpectedTests: UnexpectedTest[];
    answersWithoutCard: string[];
}

interface Expectation {
    tests: string[];
    verdict: Verdict;
    commit: string | null;
}

/**
 * Tells whether a test id is the known flake.
 * @param id - a canonical test id
 * @returns true for the `AND semantics` test in the employee search spec
 */
export function isFlake(id: string): boolean {
    const parts = id.split(ID_SEPARATOR);
    return (
        parts.length > 1 &&
        parts[0] === FLAKE_SPEC &&
        (parts.at(-1) ?? '').includes(FLAKE_TITLE_PART)
    );
}

/**
 * Compares an answered commit with the card's commit.
 * @param answered - the commit the answer names
 * @param expected - the commit on the card
 * @returns true when one is a prefix of the other and both have 7 or more characters
 */
export function commitMatches(
    answered: string | null,
    expected: string | null
): boolean {
    if (!answered || !expected) return false;
    const a = answered.trim().toLowerCase();
    const e = expected.trim().toLowerCase();
    if (a.length < MIN_COMMIT_PREFIX || e.length < MIN_COMMIT_PREFIX) {
        return false;
    }
    return e.startsWith(a) || a.startsWith(e);
}

function listSample(tests: string[]): string {
    const shown = tests.slice(0, 2).join('; ');
    return tests.length > 2 ? `${shown}; and ${tests.length - 2} more` : shown;
}

function touchingGroups(
    tests: string[],
    answer: Answer | undefined
): { group: Group; number: number }[] {
    const wanted = new Set(tests);
    return (answer?.groups ?? [])
        .map((group, index) => ({ group, number: index + 1 }))
        .filter(({ group }) => group.tests.some((t) => wanted.has(t)));
}

function judge(expected: Expectation, answer: Answer | undefined): Judgement {
    const miss = (reason: Reason, detail: string): Judgement => ({
        found: false,
        reason,
        detail,
    });
    if (!answer) return miss('no answer', 'no answer for this build');

    const wanted = new Set(expected.tests);
    const touching = touchingGroups(expected.tests, answer);

    if (touching.length === 0) {
        return miss(
            'tests missing',
            `none of the ${wanted.size} test(s) is in any group`
        );
    }
    if (touching.length > 1) {
        const numbers = touching.map(({ number }) => number).join(', ');
        return miss('tests split across groups', `in groups ${numbers}`);
    }

    const { group, number } = touching[0];
    const answered = new Set(group.tests);
    const missing = [...wanted].filter((t) => !answered.has(t));
    if (missing.length > 0) {
        return miss(
            'tests missing',
            `group ${number} lacks ${missing.length} of ${wanted.size}: ${listSample(missing)}`
        );
    }
    const extra = [...answered].filter((t) => !wanted.has(t));
    if (extra.length > 0) {
        return miss(
            'extra tests in the group',
            `group ${number} also holds ${listSample(extra)}`
        );
    }
    if (
        group.verdict === 'undetermined' &&
        expected.verdict !== 'undetermined'
    ) {
        return miss('undetermined', `group ${number} is undetermined`);
    }
    if (group.verdict !== expected.verdict) {
        return miss(
            'wrong verdict',
            `group ${number} says ${group.verdict}, the card says ${expected.verdict}`
        );
    }
    if (
        expected.verdict === 'code change' &&
        !commitMatches(group.commit, expected.commit)
    ) {
        return miss(
            'wrong commit',
            `group ${number} names ${group.commit ?? 'no commit'}, the card names ${expected.commit}`
        );
    }
    return { found: true, reason: null, detail: `group ${number}` };
}

/**
 * Scores every card against the answer for its failing build.
 * @param cards - the answer cards
 * @param answers - the analyser answers, at most one per failing build
 * @returns one result per fault, the flake rows and the answered tests no card explains
 */
export function score(cards: Card[], answers: Answer[]): Score {
    const answerByBuild = new Map<string, Answer>();
    for (const answer of answers) {
        if (answerByBuild.has(answer.failing_build)) {
            throw new Error(
                `Two answers for failing build ${answer.failing_build}.`
            );
        }
        answerByBuild.set(answer.failing_build, answer);
    }
    const cardsByBuild = new Map<string, Card[]>();
    for (const card of cards) {
        const build = card.failing_build.run_id;
        cardsByBuild.set(build, [...(cardsByBuild.get(build) ?? []), card]);
    }

    const faults: FaultResult[] = cards
        .map((card) => ({
            faultId: card.fault_id,
            failingBuild: card.failing_build.run_id,
            groups: touchingGroups(
                card.failing_tests,
                answerByBuild.get(card.failing_build.run_id)
            ).map(({ group }) => group),
            ...judge(
                {
                    tests: card.failing_tests,
                    verdict: card.verdict,
                    commit: card.commit,
                },
                answerByBuild.get(card.failing_build.run_id)
            ),
        }))
        .sort((a, b) => a.faultId.localeCompare(b.faultId));

    const builds = [
        ...new Set([...cardsByBuild.keys(), ...answerByBuild.keys()]),
    ].sort();
    const flakes: FlakeResult[] = [];
    const unexpectedTests: UnexpectedTest[] = [];
    for (const build of builds) {
        const buildCards = cardsByBuild.get(build) ?? [];
        const answer = answerByBuild.get(build);
        const answeredTests = (answer?.groups ?? []).flatMap((g) => g.tests);
        const flakeTests = [
            ...new Set(buildCards.flatMap((c) => c.flake_tests)),
        ];
        if (flakeTests.length > 0) {
            flakes.push({
                failingBuild: build,
                ...judge(
                    { tests: flakeTests, verdict: FLAKE_VERDICT, commit: null },
                    answer
                ),
            });
        }

        const explained = new Set(
            buildCards.flatMap((c) => [...c.failing_tests, ...c.flake_tests])
        );
        for (const test of new Set(answeredTests)) {
            if (!explained.has(test)) {
                unexpectedTests.push({ failingBuild: build, test });
            }
        }
    }

    const answersWithoutCard = [...answerByBuild.keys()]
        .filter((build) => !cardsByBuild.has(build))
        .sort();
    return { faults, flakes, unexpectedTests, answersWithoutCard };
}

function confidenceCell(groups: Group[]): string {
    return groups.map((g) => String(g.confidence)).join(', ');
}

function leaningCell(groups: Group[]): string {
    return groups
        .flatMap((g) =>
            g.leaning
                ? [
                      g.leaning.commit
                          ? `${g.leaning.verdict} ${g.leaning.commit.slice(0, MIN_COMMIT_PREFIX)}`
                          : g.leaning.verdict,
                  ]
                : []
        )
        .join(', ');
}

function cell(text: string): string {
    return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

/**
 * Renders a score as a short markdown report.
 * @param result - the output of `score`
 * @returns the report
 */
export function renderReport(result: Score): string {
    const { faults } = result;
    const found = faults.filter((f) => f.found).length;
    const undetermined = faults.filter(
        (f) => f.reason === 'undetermined'
    ).length;
    const noAnswer = faults.filter((f) => f.reason === 'no answer').length;
    const wrong = faults.length - found - undetermined - noAnswer;

    const lines = [
        '# Analyser score',
        '',
        `Faults: ${faults.length}. Found: ${found}. Wrong: ${wrong}. Undetermined: ${undetermined}. No answer: ${noAnswer}.`,
        '',
        '| Fault | Failing build | Result | Reason | Confidence | Leaning | Detail |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        ...faults.map(
            (f) =>
                `| ${cell(f.faultId)} | ${f.failingBuild} | ${f.found ? 'found' : 'not found'} | ${f.reason ?? ''} | ${confidenceCell(f.groups)} | ${cell(leaningCell(f.groups))} | ${cell(f.detail)} |`
        ),
    ];

    if (result.flakes.length > 0) {
        lines.push(
            '',
            '## Known flake',
            '',
            `The \`${FLAKE_TITLE_PART}\` test must be its own group with verdict ${FLAKE_VERDICT}. Not counted as a fault.`,
            '',
            '| Failing build | Result | Reason | Detail |',
            '| --- | --- | --- | --- |',
            ...result.flakes.map(
                (f) =>
                    `| ${f.failingBuild} | ${f.found ? 'right' : 'not right'} | ${f.reason ?? ''} | ${cell(f.detail)} |`
            )
        );
    }

    if (result.unexpectedTests.length > 0) {
        lines.push(
            '',
            '## Answered tests in no card',
            '',
            ...result.unexpectedTests.map(
                (u) => `- ${u.failingBuild}: \`${u.test}\``
            )
        );
    }

    if (result.answersWithoutCard.length > 0) {
        lines.push(
            '',
            '## Answers with no card',
            '',
            ...result.answersWithoutCard.map((build) => `- ${build}`)
        );
    }
    return `${lines.join('\n')}\n`;
}

type Json = Record<string, unknown>;

function asObject(value: unknown, where: string): Json {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`${where} is not an object.`);
    }
    return value as Json;
}

function asRunId(value: unknown, where: string): string {
    if (typeof value === 'number' && Number.isSafeInteger(value)) {
        return String(value);
    }
    if (typeof value === 'string' && /^\d+$/.test(value)) return value;
    throw new Error(`${where} is not a run id.`);
}

function asString(value: unknown, where: string): string {
    if (typeof value !== 'string' || value === '') {
        throw new Error(`${where} is not a non-empty string.`);
    }
    return value;
}

function asStrings(value: unknown, where: string): string[] {
    if (
        !Array.isArray(value) ||
        value.length === 0 ||
        !value.every((v) => typeof v === 'string' && v !== '')
    ) {
        throw new Error(`${where} is not a non-empty list of strings.`);
    }
    return value as string[];
}

function asStringList(value: unknown, where: string): string[] {
    if (
        !Array.isArray(value) ||
        !value.every((v) => typeof v === 'string' && v !== '')
    ) {
        throw new Error(`${where} is not a list of strings.`);
    }
    return value as string[];
}

function asVerdict(value: unknown, where: string): Verdict {
    const verdict = VERDICTS.find((v) => v === value);
    if (!verdict) {
        throw new Error(`${where} is not one of: ${VERDICTS.join(', ')}.`);
    }
    return verdict;
}

function asCommit(value: unknown, where: string): string | null {
    if (value === undefined || value === null || value === '') return null;
    return asString(value, where);
}

function asConfidence(value: unknown, where: string): number {
    if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1
    ) {
        throw new Error(`${where} is not a number from 0 to 1.`);
    }
    return value;
}

function asLeaning(value: unknown, where: string): Leaning | null {
    if (value === undefined || value === null) return null;
    const leaning = asObject(value, where);
    const verdict = asVerdict(leaning.verdict, `${where}.verdict`);
    if (verdict === 'undetermined') {
        throw new Error(`${where}.verdict cannot be undetermined.`);
    }
    return { verdict, commit: asCommit(leaning.commit, `${where}.commit`) };
}

function asLastPassed(value: unknown, where: string): LastPassed | null {
    if (value === null) return null;
    const lastPassed = asObject(value, where);
    return {
        run_id: asRunId(lastPassed.run_id, `${where}.run_id`),
        ohrm_sha: asCommit(lastPassed.ohrm_sha, `${where}.ohrm_sha`),
        test_sha: asCommit(lastPassed.test_sha, `${where}.test_sha`),
    };
}

/**
 * Reads the fields the scorer uses from a parsed answer card.
 * @param value - the parsed JSON
 * @param source - the file name, for error messages
 * @returns the card
 */
export function parseCard(value: unknown, source: string): Card {
    const json = asObject(value, source);
    const verdict = asVerdict(json.verdict, `${source}: verdict`);
    const commit = asCommit(json.commit, `${source}: commit`);
    if (verdict === 'code change' && !commit) {
        throw new Error(`${source}: a code change card needs a commit.`);
    }
    const failingTests = asStrings(
        json.failing_tests,
        `${source}: failing_tests`
    );
    if (failingTests.some(isFlake)) {
        throw new Error(
            `${source}: failing_tests holds the known flake, which belongs in flake_tests.`
        );
    }
    const flakeTests = asStringList(json.flake_tests, `${source}: flake_tests`);
    const notFlake = flakeTests.find((t) => !isFlake(t));
    if (notFlake) {
        throw new Error(
            `${source}: flake_tests holds ${notFlake}, which is not the known flake.`
        );
    }
    const failingBuild = asObject(
        json.failing_build,
        `${source}: failing_build`
    );
    return {
        fault_id: asString(json.fault_id, `${source}: fault_id`),
        verdict,
        commit,
        failing_build: {
            run_id: asRunId(
                failingBuild.run_id,
                `${source}: failing_build.run_id`
            ),
        },
        failing_tests: failingTests,
        flake_tests: flakeTests,
    };
}

/**
 * Reads the fields the scorer uses from a parsed analyser answer.
 * @param value - the parsed JSON
 * @param source - the file name, for error messages
 * @returns the answer
 */
export function parseAnswer(value: unknown, source: string): Answer {
    const json = asObject(value, source);
    if (!Array.isArray(json.groups)) {
        throw new Error(`${source}: groups is not a list.`);
    }
    const groups = json.groups.map((raw: unknown, index: number): Group => {
        const where = `${source}: groups[${index}]`;
        const group = asObject(raw, where);
        const verdict = asVerdict(group.verdict, `${where}.verdict`);
        const leaning = asLeaning(group.leaning, `${where}.leaning`);
        if (leaning && verdict !== 'undetermined') {
            throw new Error(
                `${where}: leaning is set, so verdict must be undetermined.`
            );
        }
        return {
            tests: asStrings(group.tests, `${where}.tests`),
            verdict,
            commit: asCommit(group.commit, `${where}.commit`),
            confidence: asConfidence(group.confidence, `${where}.confidence`),
            leaning,
            last_passed: asLastPassed(
                group.last_passed,
                `${where}.last_passed`
            ),
        };
    });
    return {
        failing_build: asRunId(json.failing_build, `${source}: failing_build`),
        groups,
    };
}

function readJsonFiles<T>(
    dir: string,
    parse: (value: unknown, source: string) => T
): T[] {
    return readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => {
            const file = path.join(dir, name);
            let value: unknown;
            try {
                value = JSON.parse(readFileSync(file, 'utf8'));
            } catch (error) {
                throw new Error(`${file}: not valid JSON (${String(error)}).`);
            }
            return parse(value, file);
        });
}

function main(argv: string[]): number {
    const [cardsDir, answersDir, outputFile] = argv;
    if (!cardsDir || !answersDir) {
        process.stderr.write(
            'Usage: node analyser/score.ts <cards-dir> <answers-dir> [output.md]\n'
        );
        return 2;
    }
    try {
        const cards = readJsonFiles(cardsDir, parseCard);
        const answers = readJsonFiles(answersDir, parseAnswer);
        const report = renderReport(score(cards, answers));
        if (outputFile) writeFileSync(outputFile, report);
        process.stdout.write(report);
        return 0;
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : String(error)}\n`
        );
        return 2;
    }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    process.exitCode = main(process.argv.slice(2));
}
