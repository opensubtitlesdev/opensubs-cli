import * as fs from 'fs';
import * as os from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { readFileSidecar, sidecarPathForFile, sidecarPathForFolder, writeSidecar } from '../../src/Sidecar';

// Hash-based subtitle download tests.
// Requires real video files — run tests/fixtures/download.sh first.
//
// Run with: npm run test:e2e:download
//
// These tests download actual subtitle files and verify they land on disk.
// Each test cleans up after itself.

const ROOT      = join(__dirname, '../..');
const CLI       = join(ROOT, 'dist/Run.js');
const DOWNLOADS = join(ROOT, 'tests/fixtures/downloads');

const BBB_FILE     = join(DOWNLOADS, 'BigBuckBunny_320x180.mp4');
const PIONEER_FILE = join(DOWNLOADS, 'Pioneer.One.S01E01.480p.mp4');

const BBB_IMDB_ID     = 1254207;   // Big Buck Bunny (2008) — tt1254207
const PIONEER_IMDB_ID = 1748166;   // Pioneer One (2010)    — tt1748166

const hasDownloads = fs.existsSync(BBB_FILE) && fs.existsSync(PIONEER_FILE);

if (!hasDownloads) {
    console.log('\n  ⚠  Hash-based tests skipped — run tests/fixtures/download.sh to enable\n');
}

function runCLI(args: string[]): { stdout: string; stderr: string; status: number } {
    const r = spawnSync('node', [CLI, ...args], {
        encoding: 'utf8',
        timeout: 60000,
        cwd: ROOT,
    });
    return { stdout: r.stdout || '', stderr: r.stderr || '', status: r.status ?? 1 };
}

function assertSrtExists(srtPath: string, cliResult: { stdout: string; stderr: string; status: number }) {
    if (!fs.existsSync(srtPath)) {
        throw new Error(
            `Expected .srt at ${srtPath} but it was not created.\n` +
            `CLI exit code: ${cliResult.status}\n` +
            `stdout:\n${cliResult.stdout || '(empty)'}\n` +
            `stderr:\n${cliResult.stderr || '(empty)'}`
        );
    }
}

function withTmpCopy<T>(srcPath: string, fn: (tmpPath: string) => T, name?: string): T {
    const tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'opensubs-dl-'));
    const tmpPath = join(tmpDir, name ?? srcPath.split('/').pop()!);
    fs.copyFileSync(srcPath, tmpPath);
    try {
        return fn(tmpPath);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

function withTmpEpisodeDir<T>(srcPath: string, fn: (tmpDir: string, episodePath: string) => T): T {
    const tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'opensubs-dl-'));
    const episodePath = join(tmpDir, srcPath.split('/').pop()!);
    fs.copyFileSync(srcPath, episodePath);
    try {
        return fn(tmpDir, episodePath);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

// ─── Big Buck Bunny — filename-based search (no sidecar) ─────────────────────

(hasDownloads ? describe : describe.skip)(
    'subtitle download — Big Buck Bunny via filename query', () => {

    // Use a well-formed name so guessit can extract the title for the query
    const BBB_QUERY_NAME = 'Big.Buck.Bunny.2008.mp4';

    it('downloads an English subtitle for Big Buck Bunny', () => {
        withTmpCopy(BBB_FILE, tmpPath => {
            const r = runCLI([tmpPath, '--lang', 'en', '-N']);
            const srtPath = tmpPath.replace(/\.[^.]+$/, '.en.srt');
            assertSrtExists(srtPath, r);
            expect(fs.statSync(srtPath).size).toBeGreaterThan(100);
        }, BBB_QUERY_NAME);
    });

    it('subtitle file contains SRT timestamp markers', () => {
        withTmpCopy(BBB_FILE, tmpPath => {
            const r = runCLI([tmpPath, '--lang', 'en', '-N']);
            const srtPath = tmpPath.replace(/\.[^.]+$/, '.en.srt');
            assertSrtExists(srtPath, r);
            const content = fs.readFileSync(srtPath, 'utf8');
            expect(content).toMatch(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/);
        }, BBB_QUERY_NAME);
    });

    it('does not re-download if subtitle already exists (no --overwrite)', () => {
        withTmpCopy(BBB_FILE, tmpPath => {
            const srtPath = tmpPath.replace(/\.[^.]+$/, '.en.srt');
            fs.writeFileSync(srtPath, 'existing subtitle');
            const r = runCLI([tmpPath, '--lang', 'en', '-N']);
            // Existing file should be untouched
            expect(fs.readFileSync(srtPath, 'utf8')).toBe('existing subtitle');
        }, BBB_QUERY_NAME);
    });
});

// ─── Big Buck Bunny — sidecar-based search ───────────────────────────────────

(hasDownloads ? describe : describe.skip)(
    'subtitle download — Big Buck Bunny via imdb_id sidecar', () => {

    it('downloads subtitle using sidecar imdb_id instead of filename query', () => {
        withTmpCopy(BBB_FILE, tmpPath => {
            writeSidecar(sidecarPathForFile(tmpPath), { imdb_id: BBB_IMDB_ID, type: 'movie' });
            const r = runCLI([tmpPath, '--lang', 'en', '-N']);
            const srtPath = tmpPath.replace(/\.[^.]+$/, '.en.srt');
            assertSrtExists(srtPath, r);
        });
    });
});

// ─── Pioneer One — sidecar-based episode search ───────────────────────────────

(hasDownloads ? describe : describe.skip)(
    'subtitle download — Pioneer One S01E01 via folder sidecar', () => {

    it('downloads subtitle for S01E01 using parent_imdb_id + guessit season/ep', () => {
        withTmpEpisodeDir(PIONEER_FILE, (tmpDir, episodePath) => {
            // Write folder sidecar with show IMDB ID
            writeSidecar(sidecarPathForFolder(tmpDir), {
                parent_imdb_id: PIONEER_IMDB_ID,
                type: 'episode',
            });
            const r = runCLI([episodePath, '--lang', 'en', '-N']);
            const srtPath = episodePath.replace(/\.[^.]+$/, '.en.srt');
            assertSrtExists(srtPath, r);
            expect(fs.statSync(srtPath).size).toBeGreaterThan(100);
        });
    });

    it('file-level sidecar with parent_imdb_id overrides folder sidecar', () => {
        withTmpEpisodeDir(PIONEER_FILE, (tmpDir, episodePath) => {
            // Folder sidecar with wrong ID
            writeSidecar(sidecarPathForFolder(tmpDir), {
                parent_imdb_id: 9999999,
                type: 'episode',
            });
            // File sidecar with correct ID — should win
            writeSidecar(sidecarPathForFile(episodePath), {
                parent_imdb_id: PIONEER_IMDB_ID,
                type: 'episode',
            });
            const r = runCLI([episodePath, '--lang', 'en', '-N']);
            // Should succeed despite wrong folder sidecar
            expect(r.status).toBe(0);
        });
    });
});
