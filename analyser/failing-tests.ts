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

function main(argv: string[]): number {
    const [reportPath] = argv;
    if (!reportPath) {
        process.stderr.write(
            'Usage: node analyser/failing-tests.ts <json-report/results.json>\n'
        );
        return 2;
    }
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as Report;
    const ids = failingTestIds(report);
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
