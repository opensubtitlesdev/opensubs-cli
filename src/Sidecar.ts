import { pathExistsSync, readFileSync, writeFileSync } from 'fs-extra';
import { join, dirname, basename } from 'path';

export interface SidecarData {
    imdb_id?: number;
    tmdb_id?: number;
    parent_imdb_id?: number;
    parent_tmdb_id?: number;
    type?: 'movie' | 'episode';
}

function parse(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (key && val) result[key] = val;
    }
    return result;
}

function toSidecarData(raw: Record<string, string>): SidecarData {
    const data: SidecarData = {};
    if (raw.imdb_id)         data.imdb_id         = parseInt(raw.imdb_id, 10);
    if (raw.tmdb_id)         data.tmdb_id         = parseInt(raw.tmdb_id, 10);
    if (raw.parent_imdb_id)  data.parent_imdb_id  = parseInt(raw.parent_imdb_id, 10);
    if (raw.parent_tmdb_id)  data.parent_tmdb_id  = parseInt(raw.parent_tmdb_id, 10);
    if (raw.type === 'movie' || raw.type === 'episode') data.type = raw.type;
    return data;
}

function readSidecar(path: string): SidecarData | null {
    if (!pathExistsSync(path)) return null;
    try {
        return toSidecarData(parse(readFileSync(path, 'utf8')));
    } catch {
        return null;
    }
}

/** .myfile.opensubs next to myfile.mp4 */
export function sidecarPathForFile(videoFilePath: string): string {
    const base = basename(videoFilePath).replace(/\.[^.]*$/, '');
    return join(dirname(videoFilePath), `.${base}.opensubs`);
}

/** .folder.opensubs inside the given directory */
export function sidecarPathForFolder(dirPath: string): string {
    return join(dirPath, '.folder.opensubs');
}

export function readFileSidecar(videoFilePath: string): SidecarData | null {
    return readSidecar(sidecarPathForFile(videoFilePath));
}

export function readFolderSidecar(dirPath: string): SidecarData | null {
    return readSidecar(sidecarPathForFolder(dirPath));
}

export function writeSidecar(filePath: string, data: SidecarData): void {
    const lines: string[] = [];
    if (data.imdb_id         !== undefined) lines.push(`imdb_id=${data.imdb_id}`);
    if (data.tmdb_id         !== undefined) lines.push(`tmdb_id=${data.tmdb_id}`);
    if (data.parent_imdb_id  !== undefined) lines.push(`parent_imdb_id=${data.parent_imdb_id}`);
    if (data.parent_tmdb_id  !== undefined) lines.push(`parent_tmdb_id=${data.parent_tmdb_id}`);
    if (data.type            !== undefined) lines.push(`type=${data.type}`);
    writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}
