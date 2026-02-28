"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFeaturesRaw = fetchFeaturesRaw;
exports.fetchFeatures = fetchFeatures;
exports.handleLookupFeature = handleLookupFeature;
const https = require("https");
const chalk = require("chalk");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const Guessit_1 = require("./Guessit");
const Sidecar_1 = require("./Sidecar");
const inquirer_1 = require("inquirer");
const fs_1 = require("fs");
function fetchFeaturesRaw(url) {
    return new Promise((resolve, reject) => {
        const { getApiKey } = require('./Config');
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            headers: {
                'Api-Key': getApiKey(),
                'Content-Type': 'application/json',
                'User-Agent': 'opensubs-cli v' + require('../package.json').version,
            },
        };
        https.get(options, (res) => {
            // Follow redirects
            if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                const redirectUrl = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : `https://api.opensubtitles.com${res.headers.location}`;
                res.resume(); // drain
                return fetchFeaturesRaw(redirectUrl).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode !== 200) {
                        return reject(new Error(`HTTP ${res.statusCode}: ${json.message || json.errors || data}`));
                    }
                    resolve(json.data || []);
                }
                catch (e) {
                    reject(new Error(`HTTP ${res.statusCode} — unexpected response: ${data.slice(0, 200)}`));
                }
            });
        }).on('error', reject);
    });
}
function fetchFeatures(query, type) {
    let path = `/api/v1/features?query=${encodeURIComponent(query)}`;
    if (type)
        path += `&type=${encodeURIComponent(type)}`;
    return fetchFeaturesRaw(`https://api.opensubtitles.com${path}`);
}
function handleLookupFeature(targetPath, typeOverride, // 'movie' | 'episode'
queryOverride, autoSelect) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const stat = (0, fs_extra_1.lstatSync)(targetPath);
        const isDir = stat.isDirectory();
        // Resolve query
        let query;
        let guessedType;
        if (queryOverride) {
            query = queryOverride;
        }
        else {
            const name = isDir
                ? (0, path_1.basename)(targetPath)
                : (0, path_1.basename)(targetPath).replace(/\.[^.]*$/, '');
            try {
                const guessit = yield (0, Guessit_1.callGuessit)(isDir ? name : (0, path_1.basename)(targetPath));
                query = guessit.title || name;
                guessedType = guessit.type;
            }
            catch (_b) {
                query = name;
            }
        }
        // Map user's --type to features API type ('movie' | 'tvshow')
        let apiType;
        if (typeOverride === 'movie') {
            apiType = 'movie';
        }
        else if (typeOverride === 'episode') {
            apiType = 'tvshow';
        }
        else if (isDir) {
            apiType = 'tvshow';
        }
        else if (guessedType === 'episode') {
            apiType = 'tvshow';
        }
        else if (guessedType === 'movie') {
            apiType = 'movie';
        }
        console.log(chalk.yellow(`\nSearching: ${chalk.bold(query)}${apiType ? chalk.dim(` [${apiType}]`) : ''}\n`));
        let features;
        try {
            features = yield fetchFeatures(query, apiType);
        }
        catch (e) {
            console.error(chalk.redBright(`Failed to fetch features: ${e.message}`));
            process.exit(1);
        }
        if (features.length === 0) {
            console.log(chalk.yellowBright('No results found. Try --query to refine the search.'));
            process.exit(0);
        }
        // Display
        const PAGE = Math.min(features.length, 20);
        const line = chalk.dim('─'.repeat(70));
        console.log(line);
        for (let i = 0; i < PAGE; i++) {
            const a = features[i].attributes;
            const num = chalk.cyan(`${String(i + 1).padStart(2)}.`);
            const title = chalk.bold(a.title);
            const year = a.year ? chalk.dim(` (${a.year})`) : '';
            const type = chalk.yellow(a.feature_type);
            const imdb = a.imdb_id ? chalk.green(`tt${a.imdb_id}`) : chalk.dim('no imdb');
            const url = a.url ? `\n     ${chalk.dim(a.url)}` : '';
            console.log(`${num} ${title}${year} — ${type} — ${imdb}${url}`);
        }
        console.log(line);
        let idx;
        if (autoSelect !== undefined) {
            idx = autoSelect;
            console.log(chalk.dim(`Auto-selecting result #${idx}`));
        }
        else {
            const { choice } = yield (0, inquirer_1.prompt)([{
                    type: 'input',
                    name: 'choice',
                    message: `Select 1–${PAGE} (0 to cancel):`,
                    validate: (val) => {
                        const n = parseInt(val, 10);
                        if (isNaN(n) || n < 0 || n > PAGE)
                            return `Enter a number between 0 and ${PAGE}`;
                        return true;
                    },
                }]);
            idx = parseInt(choice, 10);
            if (idx === 0) {
                console.log(chalk.yellowBright('Cancelled.'));
                process.exit(0);
            }
        }
        const selected = features[idx - 1].attributes;
        const isEpisode = ((_a = selected.feature_type) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'tvshow' || typeOverride === 'episode';
        let sidecarPath;
        let sidecarData;
        if (isDir) {
            sidecarPath = (0, Sidecar_1.sidecarPathForFolder)(targetPath);
            sidecarData = Object.assign(Object.assign(Object.assign({}, (selected.imdb_id !== undefined ? { parent_imdb_id: selected.imdb_id } : {})), (selected.tmdb_id !== undefined ? { parent_tmdb_id: selected.tmdb_id } : {})), { type: 'episode' });
        }
        else {
            sidecarPath = (0, Sidecar_1.sidecarPathForFile)(targetPath);
            sidecarData = Object.assign(Object.assign(Object.assign({}, (selected.imdb_id !== undefined ? { imdb_id: selected.imdb_id } : {})), (selected.tmdb_id !== undefined ? { tmdb_id: selected.tmdb_id } : {})), { type: isEpisode ? 'episode' : 'movie' });
        }
        (0, Sidecar_1.writeSidecar)(sidecarPath, sidecarData);
        console.log(chalk.greenBright(`\nSidecar written: ${chalk.bold(sidecarPath)}`));
        console.log(chalk.dim((0, fs_1.readFileSync)(sidecarPath, 'utf8')));
    });
}
//# sourceMappingURL=LookupFeature.js.map