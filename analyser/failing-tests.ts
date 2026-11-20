/**
 * Prints the id of every failing test in a Playwright JSON report, one per
 * line. Answer cards, analyser answers and the scorer all use these ids.
 *
 * Usage: node analyser/failing-tests.ts <json-report/results.json>
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ID_SEPARATOR = ' > ';

interface ReportResult {
    status?: string;
}

interface ReportTest {
    status?: string;
    results?: ReportResult[];
}

interface ReportSpec {
    title: string;
    file: string;
    tests?: ReportTest[];
}

interface ReportSuite {
    title: string;
    specs?: ReportSpec[];
    suites?: ReportSuite[];
}

export interface Report {
    config?: { rootDir?: string; configFile?: string };
    suites?: ReportSuite[];
    errors?: unknown[];
}

/**
 * Builds a test's canonical id.
 * @param specPath - the spec file's path from the repo root, with `/`
 * @param describeTitles - the titles of the enclosing `describe` blocks, outermost first
 * @param title - the test's own title
 * @returns `<spec path> > <describe titles> > <test title>`
 */
export function testId(
    specPath: string,
    describeTitles: string[],
    title: string
): string {
    return [specPath, ...describeTitles, title].join(ID_SEPARATOR);
}

/**
 * Reports a test as failing when Playwright marks its outcome unexpected,
 * unless its last attempt was interrupted because the whole run stopped.
 */
function isFailing(test: ReportTest): boolean {
    if (test.status !== 'unexpected') return false;
    const last = test.results?.at(-1);
    return last?.status !== 'interrupted';
}

/**
 * Lists the ids of the failing tests in a report, each id once, in report
 * order. A test that runs in several projects still has one id.
 * @param report - a parsed Playwright JSON report
 * @returns the failing test ids
 */
export function failingTestIds(report: Report): string[] {
    const rootDir = report.config?.rootDir;
    const configFile = report.config?.configFile;
    if (!rootDir || !configFile) {
        throw new Error(
            'The report has no config.rootDir or config.configFile, so spec paths cannot be resolved.'
        );
    }
    const repoRoot = path.posix.dirname(toPosix(configFile));
    const testDir = toPosix(rootDir);
    const ids = new Set<string>();

    const walk = (suite: ReportSuite, describeTitles: string[]): void => {
        for (const spec of suite.specs ?? []) {
            if (!(spec.tests ?? []).some(isFailing)) continue;
            const specPath = path.posix.relative(
                repoRoot,
                path.posix.join(testDir, toPosix(spec.file))
            );
            ids.add(testId(specPath, describeTitles, spec.title));
        }
        for (const child of suite.suites ?? []) {
            const titles = child.title
                ? [...describeTitles, child.title]
                : describeTitles;
            walk(child, titles);
        }
    };

    // A top-level suite stands for a file; its title is the file path, not a describe.
    for (const fileSuite of report.suites ?? []) walk(fileSuite, []);
    return [...ids];
}

function toPosix(p: string): string {
    return p.replaceAll('\\', '/');
}

type Json = Record<string, unknown>;

function asObject(value: unknown, where: string): Json {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`${where} is not an object.`);
    }
    return value as Json;
}

function asList(value: unknown, where: string): unknown[] {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new Error(`${where} is not a list.`);
    return value;
}

function asText(value: unknown, where: string): string {
    if (typeof value !== 'string') throw new Error(`${where} is not a string.`);
    return value;
}

function asOptionalText(value: unknown, where: string): string | undefined {
    return value === undefined ? undefined : asText(value, where);
}

function parseTest(value: unknown, where: string): ReportTest {
    const test = asObject(value, where);
    return {
        status: asOptionalText(test.status, `${where}.status`),
        results: asList(test.results, `${where}.results`).map(
            (result, i): ReportResult => ({
                status: asOptionalText(
                    asObject(result, `${where}.results[${i}]`).status,
                    `${where}.results[${i}].status`
                ),
            })
        ),
    };
}

function parseSpec(value: unknown, where: string): ReportSpec {
    const spec = asObject(value, where);
    return {
        title: asText(spec.title, `${where}.title`),
        file: asText(spec.file, `${where}.file`),
        tests: asList(spec.tests, `${where}.tests`).map((test, i) =>
            parseTest(test, `${where}.tests[${i}]`)
        ),
    };
}

function parseSuite(value: unknown, where: string): ReportSuite {
    const suite = asObject(value, where);
    return {
        title: asText(suite.title, `${where}.title`),
        specs: asList(suite.specs, `${where}.specs`).map((spec, i) =>
            parseSpec(spec, `${where}.specs[${i}]`)
        ),
        suites: asList(suite.suites, `${where}.suites`).map((child, i) =>
            parseSuite(child, `${where}.suites[${i}]`)
        ),
    };
}

/**
 * Reads the fields the lister uses from a parsed Playwright JSON report,
 * checking each one, and leaves every other field out.
 * @param value - the parsed JSON
 * @returns the report
 */
export function parseReport(value: unknown): Report {
    const report = asObject(value, 'report');
    const config =
        report.config === undefined
            ? undefined
            : asObject(report.config, 'report.config');
    return {
        config: config && {
            rootDir: asOptionalText(config.rootDir, 'report.config.rootDir'),
            configFile: asOptionalText(
                config.configFile,
                'report.config.configFile'
            ),
        },
        suites: asList(report.suites, 'report.suites').map((suite, i) =>
            parseSuite(suite, `report.suites[${i}]`)
        ),
        errors: asList(report.errors, 'report.errors'),
    };
}

function main(argv: string[]): number {
    const [reportPath] = argv;
    if (!reportPath) {
        process.stderr.write(
            'Usage: node analyser/failing-tests.ts <json-report/results.json>\n'
        );
        return 2;
    }
    let report: Report;
    let ids: string[];
    try {
        const raw: unknown = JSON.parse(readFileSync(reportPath, 'utf8'));
        report = parseReport(raw);
        ids = failingTestIds(report);
    } catch (error) {
        process.stderr.write(
            `${reportPath}: ${error instanceof Error ? error.message : String(error)}\n`
        );
        return 2;
    }
    if (ids.length > 0) process.stdout.write(`${ids.join('\n')}\n`);
    const globalErrors = report.errors?.length ?? 0;
    if (globalErrors > 0) {
        process.stderr.write(
            `warning: the report has ${globalErrors} error(s) outside any test, such as a spec that failed to load\n`
        );
    }
    return 0;
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    process.exitCode = main(process.argv.slice(2));
}
