"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sidecarPathForFile = sidecarPathForFile;
exports.sidecarPathForFolder = sidecarPathForFolder;
exports.readFileSidecar = readFileSidecar;
exports.readFolderSidecar = readFolderSidecar;
exports.writeSidecar = writeSidecar;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
function parse(content) {
    const result = {};
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const eq = trimmed.indexOf('=');
        if (eq < 1)
            continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (key && val)
            result[key] = val;
    }
    return result;
}
function toSidecarData(raw) {
    const data = {};
    if (raw.imdb_id)
        data.imdb_id = parseInt(raw.imdb_id, 10);
    if (raw.tmdb_id)
        data.tmdb_id = parseInt(raw.tmdb_id, 10);
    if (raw.parent_imdb_id)
        data.parent_imdb_id = parseInt(raw.parent_imdb_id, 10);
    if (raw.parent_tmdb_id)
        data.parent_tmdb_id = parseInt(raw.parent_tmdb_id, 10);
    if (raw.type === 'movie' || raw.type === 'episode')
        data.type = raw.type;
    return data;
}
function readSidecar(path) {
    if (!(0, fs_extra_1.pathExistsSync)(path))
        return null;
    try {
        return toSidecarData(parse((0, fs_extra_1.readFileSync)(path, 'utf8')));
    }
    catch (_a) {
        return null;
    }
}
/** .myfile.opensubs next to myfile.mp4 */
function sidecarPathForFile(videoFilePath) {
    const base = (0, path_1.basename)(videoFilePath).replace(/\.[^.]*$/, '');
    return (0, path_1.join)((0, path_1.dirname)(videoFilePath), `.${base}.opensubs`);
}
/** .folder.opensubs inside the given directory */
function sidecarPathForFolder(dirPath) {
    return (0, path_1.join)(dirPath, '.folder.opensubs');
}
function readFileSidecar(videoFilePath) {
    return readSidecar(sidecarPathForFile(videoFilePath));
}
function readFolderSidecar(dirPath) {
    return readSidecar(sidecarPathForFolder(dirPath));
}
function writeSidecar(filePath, data) {
    const lines = [];
    if (data.imdb_id !== undefined)
        lines.push(`imdb_id=${data.imdb_id}`);
    if (data.tmdb_id !== undefined)
        lines.push(`tmdb_id=${data.tmdb_id}`);
    if (data.parent_imdb_id !== undefined)
        lines.push(`parent_imdb_id=${data.parent_imdb_id}`);
    if (data.parent_tmdb_id !== undefined)
        lines.push(`parent_tmdb_id=${data.parent_tmdb_id}`);
    if (data.type !== undefined)
        lines.push(`type=${data.type}`);
    (0, fs_extra_1.writeFileSync)(filePath, lines.join('\n') + '\n', 'utf8');
}
//# sourceMappingURL=Sidecar.js.map