import * as os from 'os';
import * as fs from 'fs';
import { join } from 'path';
import {
    sidecarPathForFile,
    sidecarPathForFolder,
    writeSidecar,
    readFileSidecar,
    readFolderSidecar,
    SidecarData,
} from '../../src/Sidecar';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tmpFile(name: string): string {
    return join(os.tmpdir(), name);
}

function cleanup(...paths: string[]) {
    for (const p of paths) {
        try { fs.unlinkSync(p); } catch {}
        try { fs.rmdirSync(p); } catch {}
    }
}

// ─── sidecarPathForFile ───────────────────────────────────────────────────────

describe('sidecarPathForFile', () => {
    it('produces .basename.opensubs in the same directory', () => {
        expect(sidecarPathForFile('/movies/Frozen.2013.1080p.BluRay.x264.YIFY.mp4'))
            .toBe('/movies/.Frozen.2013.1080p.BluRay.x264.YIFY.opensubs');
    });

    it('handles a simple filename', () => {
        expect(sidecarPathForFile('/path/movie.mp4'))
            .toBe('/path/.movie.opensubs');
    });

    it('handles mkv extension', () => {
        expect(sidecarPathForFile('/path/to/Pose S02e01 Acting Up.mkv'))
            .toBe('/path/to/.Pose S02e01 Acting Up.opensubs');
    });
});

// ─── sidecarPathForFolder ─────────────────────────────────────────────────────

describe('sidecarPathForFolder', () => {
    it('produces .folder.opensubs inside the directory', () => {
        expect(sidecarPathForFolder('/tvshows/Pose/Season 2'))
            .toBe('/tvshows/Pose/Season 2/.folder.opensubs');
    });

    it('handles trailing slash-free path', () => {
        expect(sidecarPathForFolder('/tvshows/Pose/Season 3'))
            .toBe('/tvshows/Pose/Season 3/.folder.opensubs');
    });
});

// ─── writeSidecar / readFileSidecar roundtrip ─────────────────────────────────

describe('writeSidecar + readFileSidecar', () => {
    const videoFile = tmpFile('test-movie-unit.mp4');

    beforeEach(() => { fs.writeFileSync(videoFile, ''); });
    afterEach(() => { cleanup(videoFile, sidecarPathForFile(videoFile)); });

    it('roundtrips a movie sidecar (Frozen — tt2294629)', () => {
        const data: SidecarData = { imdb_id: 2294629, type: 'movie' };
        writeSidecar(sidecarPathForFile(videoFile), data);
        expect(readFileSidecar(videoFile)).toEqual(data);
    });

    it('roundtrips a folder-style episode sidecar (Pose — tt7562112)', () => {
        const data: SidecarData = { parent_imdb_id: 7562112, type: 'episode' };
        writeSidecar(sidecarPathForFile(videoFile), data);
        expect(readFileSidecar(videoFile)).toEqual(data);
    });

    it('roundtrips all fields', () => {
        const data: SidecarData = {
            imdb_id: 2294629,
            tmdb_id: 109445,
            parent_imdb_id: 99999,
            parent_tmdb_id: 88888,
            type: 'movie',
        };
        writeSidecar(sidecarPathForFile(videoFile), data);
        expect(readFileSidecar(videoFile)).toEqual(data);
    });

    it('produces a human-readable key=value file', () => {
        writeSidecar(sidecarPathForFile(videoFile), { imdb_id: 2294629, type: 'movie' });
        const raw = fs.readFileSync(sidecarPathForFile(videoFile), 'utf8');
        expect(raw).toContain('imdb_id=2294629');
        expect(raw).toContain('type=movie');
    });

    it('does not include undefined fields in output', () => {
        writeSidecar(sidecarPathForFile(videoFile), { imdb_id: 2294629, type: 'movie' });
        const raw = fs.readFileSync(sidecarPathForFile(videoFile), 'utf8');
        expect(raw).not.toContain('tmdb_id');
        expect(raw).not.toContain('parent_imdb_id');
    });
});

// ─── readFileSidecar — edge cases ────────────────────────────────────────────

describe('readFileSidecar edge cases', () => {
    const videoFile = tmpFile('test-edge-unit.mp4');

    afterEach(() => { cleanup(videoFile, sidecarPathForFile(videoFile)); });

    it('returns null when no sidecar exists', () => {
        fs.writeFileSync(videoFile, '');
        expect(readFileSidecar(videoFile)).toBeNull();
    });

    it('returns null for a non-existent video file path', () => {
        expect(readFileSidecar('/nonexistent/path/file.mp4')).toBeNull();
    });

    it('ignores comment lines (# ...)', () => {
        fs.writeFileSync(videoFile, '');
        fs.writeFileSync(sidecarPathForFile(videoFile),
            '# this is a comment\nimdb_id=2294629\ntype=movie\n');
        const data = readFileSidecar(videoFile);
        expect(data?.imdb_id).toBe(2294629);
        expect(data?.type).toBe('movie');
    });

    it('ignores blank lines', () => {
        fs.writeFileSync(videoFile, '');
        fs.writeFileSync(sidecarPathForFile(videoFile),
            '\nimdb_id=2294629\n\ntype=movie\n\n');
        const data = readFileSidecar(videoFile);
        expect(data?.imdb_id).toBe(2294629);
    });

    it('handles whitespace around = separator', () => {
        fs.writeFileSync(videoFile, '');
        fs.writeFileSync(sidecarPathForFile(videoFile), 'imdb_id = 2294629\ntype = movie\n');
        const data = readFileSidecar(videoFile);
        expect(data?.imdb_id).toBe(2294629);
        expect(data?.type).toBe('movie');
    });

    it('ignores unknown keys gracefully', () => {
        fs.writeFileSync(videoFile, '');
        fs.writeFileSync(sidecarPathForFile(videoFile),
            'imdb_id=2294629\nunknown_key=value\ntype=movie\n');
        const data = readFileSidecar(videoFile);
        expect(data?.imdb_id).toBe(2294629);
        expect((data as any)?.unknown_key).toBeUndefined();
    });

    it('rejects unknown type values — falls back to undefined', () => {
        fs.writeFileSync(videoFile, '');
        fs.writeFileSync(sidecarPathForFile(videoFile), 'imdb_id=2294629\ntype=tvshow\n');
        const data = readFileSidecar(videoFile);
        expect(data?.type).toBeUndefined();
    });
});

// ─── readFolderSidecar ────────────────────────────────────────────────────────

describe('readFolderSidecar', () => {
    const tmpDir = join(os.tmpdir(), 'opensubs-unit-folder-test');

    beforeEach(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('reads .folder.opensubs from inside a directory', () => {
        const data: SidecarData = { parent_imdb_id: 7562112, type: 'episode' };
        writeSidecar(sidecarPathForFolder(tmpDir), data);
        expect(readFolderSidecar(tmpDir)).toEqual(data);
    });

    it('returns null when .folder.opensubs is absent', () => {
        expect(readFolderSidecar(tmpDir)).toBeNull();
    });
});
