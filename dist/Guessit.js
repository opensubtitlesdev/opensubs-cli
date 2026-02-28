"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callGuessit = callGuessit;
const https = require("https");
const path_1 = require("path");
function callGuessit(filename) {
    return new Promise((resolve, reject) => {
        const { getApiKey } = require('./Config');
        const encoded = encodeURIComponent((0, path_1.basename)(filename));
        const options = {
            hostname: 'api.opensubtitles.com',
            path: `/api/v1/utilities/guessit?filename=${encoded}`,
            headers: {
                'Api-Key': getApiKey(),
                'Content-Type': 'application/json',
                'User-Agent': 'opensubs-cli v' + require('../package.json').version,
            },
        };
        https.get(options, (res) => {
            if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                res.resume();
                return reject(new Error(`Guessit redirect to ${res.headers.location}`));
            }
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch (e) {
                    reject(new Error(`Guessit HTTP ${res.statusCode} — unexpected response: ${data.slice(0, 200)}`));
                }
            });
        }).on('error', reject);
    });
}
//# sourceMappingURL=Guessit.js.map