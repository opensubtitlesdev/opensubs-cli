import * as fs from 'fs';
import * as os from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import {
    readFileSidecar,
    readFolderSidecar,
    sidecarPathForFile,
    sidecarPathForFolder,
} from '../../src/Sidecar';
import { fetchFeatures } from '../../src/LookupFeature';

// E2E tests — spawn the compiled CLI against fixture stub files.
// Stubs are committed to git (1KB zeros). Real video files are NOT needed here
// — sidecar-based lookup only uses the filename and IMDB ID, never the content.
//
// Run with: npm run test:e2e

const ROOT    = join(__dirname, '../..');
const CLI     = join(ROOT, 'dist/Run.js');
const STUBS   = join(ROOT, 'tests/fixtures/stubs');

const BBB_STUB     = join(STUBS, 'Big.Buck.Bunny.2008.320x180.mp4');
const PIONEER_STUB = join(STUBS, 'Pioneer.One.S01E01.480p.mp4');

const BBB_IMDB_ID     = 1254207;   // Big Buck Bunny (2008) — tt1254207
const PIONEER_IMDB_ID = 1748166;   // Pioneer One (2010)   — tt1748166

function runCLI(args: string[]): { stdout: string; stderr: string; status: number } {
    const r = spawnSync('node', [CLI, ...args], {
        encoding: 'utf8',
        timeout: 30000,
        cwd: ROOT,
    });
    return { stdout: r.stdout || '', stderr: r.stderr || '', status: r.status ?? 1 };
}

function withTmpCopy<T>(stubPath: string, fn: (tmpPath: string) => T): T {
    const tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'opensubs-e2e-'));
    const tmpPath = join(tmpDir, stubPath.split('/').pop()!);
    fs.copyFileSync(stubPath, tmpPath);
    try {
        return fn(tmpPath);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

function withTmpDir<T>(fn: (tmpDir: string) => T): T {
    const tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'opensubs-e2e-'));
    try {
        return fn(tmpDir);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

// ─── Setup: find --select indices dynamically ─────────────────────────────────
// Query the API before tests so --select <n> points to the right result
// even if API ordering changes.

let bbbSelectIdx     = 1;
let pioneerSelectIdx = 1;

beforeAll(async () => {
    const bbbResults = await fetchFeatures('Big Buck Bunny', 'movie');
    const bi = bbbResults.findIndex(r => r.attributes.imdb_id === BBB_IMDB_ID);
    if (bi >= 0) bbbSelectIdx = bi + 1;

    const pioneerResults = await fetchFeatures('Pioneer One', 'tvshow');
    const pi = pioneerResults.findIndex(r => r.attributes.imdb_id === PIONEER_IMDB_ID);
    if (pi >= 0) pioneerSelectIdx = pi + 1;
});

// ─── -W on movie stub (Big Buck Bunny) ───────────────────────────────────────

describe('-W on movie stub — Big Buck Bunny (tt1254207)', () => {
    it('exits with code 0', () => {
        withTmpCopy(BBB_STUB, tmpPath => {
            const r = runCLI(['-W', tmpPath, '--type', 'movie', '--select', String(bbbSelectIdx)]);
            expect(r.status).toBe(0);
        });
    });

    it('creates a sidecar file next to the stub', () => {
        withTmpCopy(BBB_STUB, tmpPath => {
            runCLI(['-W', tmpPath, '--type', 'movie', '--select', String(bbbSelectIdx)]);
            expect(fs.existsSync(sidecarPathForFile(tmpPath))).toBe(true);
        });
    });

    it('sidecar has imdb_id=1254207 and type=movie', () => {
        withTmpCopy(BBB_STUB, tmpPath => {
            runCLI(['-W', tmpPath, '--type', 'movie', '--select', String(bbbSelectIdx)]);
            const sidecar = readFileSidecar(tmpPath);
            expect(sidecar?.imdb_id).toBe(BBB_IMDB_ID);
            expect(sidecar?.type).toBe('movie');
        });
    });

    it('prints the sidecar path in output', () => {
        withTmpCopy(BBB_STUB, tmpPath => {
            const r = runCLI(['-W', tmpPath, '--type', 'movie', '--select', String(bbbSelectIdx)]);
            expect(r.stdout).toContain('.opensubs');
        });
    });

    it('--query override still finds Big Buck Bunny', () => {
        withTmpCopy(BBB_STUB, tmpPath => {
            runCLI(['-W', tmpPath, '--type', 'movie',
                '--query', 'Big Buck Bunny', '--select', String(bbbSelectIdx)]);
            const sidecar = readFileSidecar(tmpPath);
            expect(sidecar?.imdb_id).toBe(BBB_IMDB_ID);
        });
    });
});

// ─── -W on TV folder (Pioneer One) ───────────────────────────────────────────

describe('-W on TV show folder — Pioneer One (tt1748166)', () => {
    it('exits with code 0', () => {
        withTmpDir(tmpDir => {
            const r = runCLI(['-W', tmpDir, '--query', 'Pioneer One',
                '--select', String(pioneerSelectIdx)]);
            expect(r.status).toBe(0);
        });
    });

    it('creates .folder.opensubs inside the directory', () => {
        withTmpDir(tmpDir => {
            runCLI(['-W', tmpDir, '--query', 'Pioneer One',
                '--select', String(pioneerSelectIdx)]);
            expect(fs.existsSync(sidecarPathForFolder(tmpDir))).toBe(true);
        });
    });

    it('sidecar has parent_imdb_id=1748166 and type=episode', () => {
        withTmpDir(tmpDir => {
            runCLI(['-W', tmpDir, '--query', 'Pioneer One',
                '--select', String(pioneerSelectIdx)]);
            const sidecar = readFolderSidecar(tmpDir);
            expect(sidecar?.parent_imdb_id).toBe(PIONEER_IMDB_ID);
            expect(sidecar?.type).toBe('episode');
        });
    });

    it('does NOT create a file-level sidecar (only .folder.opensubs)', () => {
        withTmpDir(tmpDir => {
            runCLI(['-W', tmpDir, '--query', 'Pioneer One',
                '--select', String(pioneerSelectIdx)]);
            const entries = fs.readdirSync(tmpDir);
            const fileSidecars = entries.filter(
                e => e.endsWith('.opensubs') && e !== '.folder.opensubs'
            );
            expect(fileSidecars).toHaveLength(0);
        });
    });
});

// ─── -W --type episode on a single episode stub ───────────────────────────────

describe('-W --type episode on a single episode file', () => {
    it('creates file sidecar with type=episode', () => {
        withTmpCopy(PIONEER_STUB, tmpPath => {
            runCLI(['-W', tmpPath, '--type', 'episode',
                '--query', 'Pioneer One', '--select', String(pioneerSelectIdx)]);
            const sidecar = readFileSidecar(tmpPath);
            expect(sidecar?.type).toBe('episode');
            expect(sidecar?.imdb_id).toBeDefined();
        });
    });
});

// ─── Sidecar file format ──────────────────────────────────────────────────────

describe('sidecar file format', () => {
    it('Big Buck Bunny sidecar is human-readable key=value text', () => {
        withTmpCopy(BBB_STUB, tmpPath => {
            runCLI(['-W', tmpPath, '--type', 'movie', '--select', String(bbbSelectIdx)]);
            const raw = fs.readFileSync(sidecarPathForFile(tmpPath), 'utf8');
            expect(raw).toMatch(/^imdb_id=\d+/m);
            expect(raw).toMatch(/^type=movie/m);
        });
    });

    it('Pioneer One folder sidecar uses parent_imdb_id', () => {
        withTmpDir(tmpDir => {
            runCLI(['-W', tmpDir, '--query', 'Pioneer One',
                '--select', String(pioneerSelectIdx)]);
            const raw = fs.readFileSync(sidecarPathForFolder(tmpDir), 'utf8');
            expect(raw).toMatch(/^parent_imdb_id=\d+/m);
            expect(raw).toMatch(/^type=episode/m);
        });
    });
});
