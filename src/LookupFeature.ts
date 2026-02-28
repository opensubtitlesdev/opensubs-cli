import * as https from 'https';
import * as chalk from 'chalk';
import { lstatSync } from 'fs-extra';
import { basename } from 'path';
import { callGuessit } from './Guessit';
import { writeSidecar, sidecarPathForFile, sidecarPathForFolder, SidecarData } from './Sidecar';
import { prompt } from 'inquirer';
import { readFileSync } from 'fs';

interface FeatureAttributes {
    title: string;
    year?: string | number;
    feature_type?: string;   // 'Movie' | 'Tvshow' — may be absent for movies
    imdb_id?: number;
    tmdb_id?: number;
    url?: string;
}

interface FeatureResult {
    id: number | string;
    type: string;
    attributes: FeatureAttributes;
}

export function fetchFeaturesRaw(url: string): Promise<FeatureResult[]> {
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
        https.get(options, (res: any) => {
            // Follow redirects
            if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                const redirectUrl = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : `https://api.opensubtitles.com${res.headers.location}`;
                res.resume(); // drain
                return fetchFeaturesRaw(redirectUrl).then(resolve).catch(reject);
            }

            let data = '';
            res.on('data', (chunk: string) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode !== 200) {
                        return reject(new Error(`HTTP ${res.statusCode}: ${json.message || json.errors || data}`));
                    }
                    resolve(json.data || []);
                } catch (e) {
                    reject(new Error(`HTTP ${res.statusCode} — unexpected response: ${data.slice(0, 200)}`));
                }
            });
        }).on('error', reject);
    });
}

export function fetchFeatures(query: string, type?: string): Promise<FeatureResult[]> {
    let path = `/api/v1/features?query=${encodeURIComponent(query)}`;
    if (type) path += `&type=${encodeURIComponent(type)}`;
    return fetchFeaturesRaw(`https://api.opensubtitles.com${path}`);
}

export async function handleLookupFeature(
    targetPath: string,
    typeOverride?: string,   // 'movie' | 'episode'
    queryOverride?: string,
    autoSelect?: number,     // 1-based; skips interactive prompt
): Promise<void> {
    const stat = lstatSync(targetPath);
    const isDir = stat.isDirectory();

    // Resolve query
    let query: string;
    let guessedType: string | undefined;

    if (queryOverride) {
        query = queryOverride;
    } else {
        const name = isDir
            ? basename(targetPath)
            : basename(targetPath).replace(/\.[^.]*$/, '');
        try {
            const guessit = await callGuessit(isDir ? name : basename(targetPath));
            query = guessit.title || name;
            guessedType = guessit.type;
        } catch {
            query = name;
        }
    }

    // Map user's --type to features API type ('movie' | 'tvshow')
    let apiType: string | undefined;
    if (typeOverride === 'movie') {
        apiType = 'movie';
    } else if (typeOverride === 'episode') {
        apiType = 'tvshow';
    } else if (isDir) {
        apiType = 'tvshow';
    } else if (guessedType === 'episode') {
        apiType = 'tvshow';
    } else if (guessedType === 'movie') {
        apiType = 'movie';
    }

    console.log(chalk.yellow(`\nSearching: ${chalk.bold(query)}${apiType ? chalk.dim(` [${apiType}]`) : ''}\n`));

    let features: FeatureResult[];
    try {
        features = await fetchFeatures(query, apiType);
    } catch (e) {
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
        const num   = chalk.cyan(`${String(i + 1).padStart(2)}.`);
        const title = chalk.bold(a.title);
        const year  = a.year ? chalk.dim(` (${a.year})`) : '';
        const type  = chalk.yellow(a.feature_type);
        const imdb  = a.imdb_id ? chalk.green(`tt${a.imdb_id}`) : chalk.dim('no imdb');
        const url   = a.url ? `\n     ${chalk.dim(a.url)}` : '';
        console.log(`${num} ${title}${year} — ${type} — ${imdb}${url}`);
    }
    console.log(line);

    let idx: number;
    if (autoSelect !== undefined) {
        idx = autoSelect;
        console.log(chalk.dim(`Auto-selecting result #${idx}`));
    } else {
        const { choice } = await prompt([{
            type: 'input',
            name: 'choice',
            message: `Select 1–${PAGE} (0 to cancel):`,
            validate: (val: string) => {
                const n = parseInt(val, 10);
                if (isNaN(n) || n < 0 || n > PAGE) return `Enter a number between 0 and ${PAGE}`;
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
    const isEpisode = selected.feature_type?.toLowerCase() === 'tvshow' || typeOverride === 'episode';

    let sidecarPath: string;
    let sidecarData: SidecarData;

    if (isDir) {
        sidecarPath = sidecarPathForFolder(targetPath);
        sidecarData = {
            ...(selected.imdb_id  !== undefined ? { parent_imdb_id: selected.imdb_id }  : {}),
            ...(selected.tmdb_id  !== undefined ? { parent_tmdb_id: selected.tmdb_id }  : {}),
            type: 'episode',
        };
    } else {
        sidecarPath = sidecarPathForFile(targetPath);
        sidecarData = {
            ...(selected.imdb_id  !== undefined ? { imdb_id: selected.imdb_id }  : {}),
            ...(selected.tmdb_id  !== undefined ? { tmdb_id: selected.tmdb_id }  : {}),
            type: isEpisode ? 'episode' : 'movie',
        };
    }

    writeSidecar(sidecarPath, sidecarData);

    console.log(chalk.greenBright(`\nSidecar written: ${chalk.bold(sidecarPath)}`));
    console.log(chalk.dim(readFileSync(sidecarPath, 'utf8')));
}
