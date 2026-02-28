import * as https from 'https';
import { basename } from 'path';

export interface GuessitResult {
    title?: string;
    year?: number;
    type?: string;       // 'movie' | 'episode'
    season?: number;
    episode?: number;
    screen_size?: string;
}

export function callGuessit(filename: string): Promise<GuessitResult> {
    return new Promise((resolve, reject) => {
        const { getApiKey } = require('./Config');
        const encoded = encodeURIComponent(basename(filename));
        const options = {
            hostname: 'api.opensubtitles.com',
            path: `/api/v1/utilities/guessit?filename=${encoded}`,
            headers: {
                'Api-Key': getApiKey(),
                'Content-Type': 'application/json',
                'User-Agent': 'opensubs-cli v' + require('../package.json').version,
            },
        };
        https.get(options, (res: any) => {
            if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                res.resume();
                return reject(new Error(`Guessit redirect to ${res.headers.location}`));
            }
            let data = '';
            res.on('data', (chunk: string) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Guessit HTTP ${res.statusCode} — unexpected response: ${data.slice(0, 200)}`));
                }
            });
        }).on('error', reject);
    });
}
