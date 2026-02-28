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
exports.isString = isString;
exports.getLang = getLang;
exports.fetchApiLanguages = fetchApiLanguages;
exports.fetchUserInfo = fetchUserInfo;
exports.downloadFile = downloadFile;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const https = require("https");
const zlib_1 = require("zlib");
const stream_1 = require("stream");
const util_1 = require("util");
const fs_1 = require("fs");
const pipe = (0, util_1.promisify)(stream_1.pipeline);
function isString(...str) {
    for (let s of str) {
        if (typeof s !== "string" || s.length < 1) {
            return false;
        }
    }
    return true;
}
function getLang(lang) {
    const json = (0, fs_extra_1.readJsonSync)((0, path_1.join)(__dirname, "../langs.json"));
    const languages = Array.isArray(json) ? json : (json.data || []);
    const found = languages.find(l => l.language_code === lang);
    if (!found)
        return null;
    return { alpha2: found.language_code, alpha3: found.language_code, name: found.language_name };
}
function fetchApiLanguages() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const { getApiKey } = require('./Config');
            const options = {
                hostname: 'api.opensubtitles.com',
                path: '/api/v1/infos/languages',
                headers: {
                    'Api-Key': getApiKey(),
                    'Content-Type': 'application/json',
                    'User-Agent': 'opensubs-cli v' + require('../package.json').version
                }
            };
            https.get(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json.data || []);
                    }
                    catch (e) {
                        reject(new Error('Failed to parse language list from API'));
                    }
                });
            }).on('error', reject);
        });
    });
}
function fetchUserInfo(token) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const { getApiKey } = require('./Config');
            const headers = {
                'Api-Key': getApiKey(),
                'Content-Type': 'application/json',
                'User-Agent': 'opensubs-cli v' + require('../package.json').version
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const options = {
                hostname: 'api.opensubtitles.com',
                path: '/api/v1/infos/user',
                headers
            };
            https.get(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json.data || json);
                    }
                    catch (e) {
                        reject(new Error('Failed to parse user info from API'));
                    }
                });
            }).on('error', reject);
        });
    });
}
function downloadFile(url_1, path_2) {
    return __awaiter(this, arguments, void 0, function* (url, path, unzip = true) {
        return new Promise((resolve, reject) => {
            // Parse URL properly to handle redirects and different domains
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : require('http');
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                headers: {
                    "User-Agent": "TemporaryUserAgent"
                }
            };
            protocol.get(options, (res) => {
                // Handle redirects
                if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
                    const redirectUrl = res.headers.location;
                    if (redirectUrl) {
                        // Resolve relative URLs
                        const absoluteUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, url).href;
                        return downloadFile(absoluteUrl, path, unzip).then(resolve).catch(reject);
                    }
                }
                if (res.statusCode === 200) {
                    let writeFile;
                    let fStream = (0, fs_1.createWriteStream)(path);
                    if (unzip) {
                        writeFile = pipe(res, (0, zlib_1.createUnzip)(), fStream);
                    }
                    else {
                        writeFile = pipe(res, fStream);
                    }
                    writeFile
                        .then(() => resolve(res.headers))
                        .catch(e => reject(new Error(e.message)));
                }
                else {
                    reject(new Error(`${res.statusCode} ${res.statusMessage}`));
                }
            }).on('error', (err) => {
                reject(err);
            });
        });
    });
}
//# sourceMappingURL=Util.js.map