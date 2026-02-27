#!/usr/bin/env node
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
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const ora = require("ora");
const ArgPars_1 = require("./ArgPars");
const chalk = require("chalk");
const keytar = require("keytar");
const Preferences_1 = require("./Preferences");
const Authentication_1 = require("./Authentication");
const Util_1 = require("./Util");
const inquirer_1 = require("inquirer");
const DownloadEventHandler_1 = require("./DownloadEventHandler");
const os_1 = require("os");
const child_process_1 = require("child_process");
const DebugLogger_1 = require("./DebugLogger");
const MovieHash_1 = require("./MovieHash");
const args = (0, ArgPars_1.default)();
// Enable debug mode if requested
if (args.debug || args.debugRequest || args.debugResponse || args.debugHeaders) {
    const debugOptions = {
        request: args.debug || args.debugRequest,
        response: args.debug || args.debugResponse,
        headers: args.debug || args.debugHeaders
    };
    (0, DebugLogger_1.enableDebug)(debugOptions);
    (0, DebugLogger_1.interceptHTTPS)();
}
let osub;
let quota = -Infinity;
// Rate limiting: promise-chain queue that spaces every API call by RATE_LIMIT_DELAY_MS.
// This avoids the race-condition in a simple lastRequestTime check — multiple concurrent
// callers each atomically grab the current chain tail and chain off it, so they form a
// strict FIFO queue with guaranteed minimum spacing between requests.
// The API allows 5 req/s; we use 350 ms (~2.8 req/s) to stay safely under that.
const RATE_LIMIT_DELAY_MS = 350;
let rateLimitChain = Promise.resolve();
function rateLimit() {
    return __awaiter(this, void 0, void 0, function* () {
        let resolveSlot;
        const mySlot = new Promise(r => { resolveSlot = r; });
        // Atomically take the current tail and replace it with ours.
        // Because JS is single-threaded, nothing can interleave between these two lines.
        const previousSlot = rateLimitChain;
        rateLimitChain = mySlot;
        // Wait for everyone ahead of us to finish their delay
        yield previousSlot;
        // Give the next caller their turn after our delay
        setTimeout(resolveSlot, RATE_LIMIT_DELAY_MS);
        // (we ourselves proceed immediately — the delay only gates the *next* caller)
    });
}
function handleSetLanguages() {
    return __awaiter(this, void 0, void 0, function* () {
        yield Preferences_1.default.loadPreferences();
        process.stdout.write(chalk.yellow("Fetching language list from OpenSubtitles.com..."));
        let languages;
        try {
            languages = yield (0, Util_1.fetchApiLanguages)();
            process.stdout.write(" done.\n\n");
        }
        catch (e) {
            process.stdout.write("\n");
            console.error(chalk.redBright(`Failed to fetch languages: ${e.message}`));
            process.exit(1);
        }
        // Display in two columns: code (left-padded) + name
        console.log(chalk.bold("Available languages:"));
        console.log(chalk.dim("─".repeat(44)));
        const col = Math.ceil(languages.length / 2);
        for (let i = 0; i < col; i++) {
            const left = languages[i];
            const right = languages[i + col];
            const leftStr = `  ${chalk.cyan(left.language_code.padEnd(8))} ${left.language_name.padEnd(26)}`;
            const rightStr = right ? `  ${chalk.cyan(right.language_code.padEnd(8))} ${right.language_name}` : "";
            console.log(leftStr + rightStr);
        }
        console.log(chalk.dim("─".repeat(44)));
        console.log();
        const availableCodes = new Set(languages.map(l => l.language_code));
        const { input } = yield (0, inquirer_1.prompt)([{
                type: "input",
                name: "input",
                message: "Enter language code(s) separated by commas (e.g. en,fr,de):",
                validate: (val) => {
                    const codes = val.split(",").map(c => c.trim()).filter(Boolean);
                    if (codes.length === 0)
                        return "Please enter at least one language code.";
                    const invalid = codes.filter(c => !availableCodes.has(c));
                    if (invalid.length > 0)
                        return `Invalid code(s): ${invalid.join(", ")}. Check the list above.`;
                    return true;
                }
            }]);
        const codes = input.split(",").map((c) => c.trim()).filter(Boolean);
        Preferences_1.default.lang = codes.join(",");
        const names = codes
            .map((c) => { var _a, _b; return (_b = (_a = languages.find(l => l.language_code === c)) === null || _a === void 0 ? void 0 : _a.language_name) !== null && _b !== void 0 ? _b : c; })
            .join(", ");
        console.log(chalk.greenBright(`\nDefault language(s) set to: ${chalk.bold(names)} (${chalk.cyan(codes.join(","))})\n`));
    });
}
function showConfig() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        yield Preferences_1.default.loadPreferences();
        const accounts = yield keytar.findCredentials("opensubtitles.com");
        const savedAccount = Preferences_1.default.account;
        const matchedAccount = (_b = (_a = accounts.find(a => a.account === savedAccount)) !== null && _a !== void 0 ? _a : accounts[0]) !== null && _b !== void 0 ? _b : null;
        const savedToken = Preferences_1.default.getToken();
        let tokenStatus;
        if (!savedToken) {
            tokenStatus = chalk.gray("(none)");
        }
        else if (Preferences_1.default.isTokenExpired(savedToken)) {
            tokenStatus = chalk.redBright("expired");
        }
        else {
            tokenStatus = chalk.greenBright("valid");
        }
        const line = chalk.cyan("─".repeat(44));
        console.log();
        console.log(chalk.bold.cyan("  OpenSubs CLI Configuration"));
        console.log(line);
        console.log(`  Config file : ${chalk.yellow(Preferences_1.PREF_FILE)}`);
        console.log(`  Username    : ${matchedAccount ? chalk.greenBright(matchedAccount.account) : chalk.gray("(not set)")}`);
        console.log(`  Password    : ${matchedAccount ? chalk.greenBright("*****") + chalk.gray(" (stored in system keychain)") : chalk.gray("(not set)")}`);
        console.log(`  Language    : ${Preferences_1.default.lang ? chalk.greenBright(Preferences_1.default.lang) : chalk.gray("(not set — defaults to eng)")}`);
        console.log(`  Anon quota  : ${chalk.yellow(Preferences_1.default.anonymousDownloadCount + "/5")} downloads used`);
        console.log(`  Auth token  : ${tokenStatus}`);
        console.log(line);
        console.log();
    });
}
function handleInfo() {
    return __awaiter(this, void 0, void 0, function* () {
        yield Preferences_1.default.loadPreferences();
        const savedToken = Preferences_1.default.getToken();
        const isAuthenticated = !!savedToken && !Preferences_1.default.isTokenExpired(savedToken);
        const spinner = ora(chalk.yellow("Fetching account info...")).start();
        let info;
        try {
            info = yield (0, Util_1.fetchUserInfo)(isAuthenticated ? savedToken : null);
            spinner.stop();
        }
        catch (e) {
            spinner.stop();
            console.error(chalk.redBright(`Failed to fetch user info: ${e.message}`));
            process.exit(1);
        }
        const line = chalk.cyan("─".repeat(44));
        const yesNo = (v) => v ? chalk.greenBright("Yes") : chalk.gray("No");
        console.log();
        console.log(chalk.bold.cyan("  OpenSubs — Account Info"));
        console.log(line);
        if (info.username)
            console.log(`  Username           : ${chalk.greenBright(info.username)}`);
        console.log(`  Level              : ${chalk.yellow(info.level)}`);
        if (info.user_id)
            console.log(`  User ID            : ${chalk.white(String(info.user_id))}`);
        console.log(`  Allowed downloads  : ${chalk.yellow(String(info.allowed_downloads))}`);
        if (info.remaining_downloads !== undefined)
            console.log(`  Remaining today    : ${chalk.yellow(String(info.remaining_downloads))}`);
        if (info.downloads_count !== undefined)
            console.log(`  Downloads used     : ${chalk.yellow(String(info.downloads_count))}`);
        console.log(`  VIP                : ${yesNo(info.vip)}`);
        console.log(`  Authenticated      : ${yesNo(isAuthenticated)}`);
        console.log(line);
        console.log();
    });
}
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        if (args.config) {
            yield showConfig();
            return;
        }
        if (args.info) {
            yield handleInfo();
            return;
        }
        if (args.setLanguages) {
            yield handleSetLanguages();
            return;
        }
        const targetPath = getPath();
        const { files } = getFiles(targetPath);
        if (files.length < 1) {
            console.log(chalk.yellowBright(`${os_1.EOL}No video files found${os_1.EOL}`));
            return;
        }
        yield Preferences_1.default.loadPreferences();
        const lang = getLanguage();
        // Check for saved bearer token first
        const savedToken = Preferences_1.default.getToken();
        let useAuthenticated = false;
        if (args.debug || args.debugRequest) {
            (0, DebugLogger_1.debugLog)(`[DEBUG] Saved token: ${savedToken ? 'exists' : 'null'}`);
            if (savedToken) {
                (0, DebugLogger_1.debugLog)(`[DEBUG] Token expired: ${Preferences_1.default.isTokenExpired(savedToken)}`);
            }
        }
        if (savedToken && !Preferences_1.default.isTokenExpired(savedToken)) {
            // Use saved token from previous login
            console.log(chalk.greenBright(`Using saved authentication token.${os_1.EOL}`));
            osub = yield (0, Authentication_1.createAuthenticatedClient)(savedToken);
            useAuthenticated = true;
            // Reset anonymous download count when using authenticated mode
            Preferences_1.default.resetAnonymousDownloadCount();
        }
        else {
            // Clear expired token if any
            if (savedToken) {
                console.log(chalk.yellowBright(`Saved authentication token has expired.${os_1.EOL}`));
                Preferences_1.default.clearToken();
            }
            // Check if user can use anonymous mode (less than 5 downloads)
            const anonymousDownloads = Preferences_1.default.anonymousDownloadCount;
            if (anonymousDownloads < 5) {
                console.log(chalk.blueBright(`Using anonymous mode (${anonymousDownloads}/5 downloads used). You can download ${5 - anonymousDownloads} more subtitle(s) before needing to login.${os_1.EOL}`));
                osub = yield (0, Authentication_1.createAnonymousClient)();
            }
            else {
                // Anonymous quota exhausted, prompt for login immediately
                console.log(chalk.yellowBright(`You've used your 5 free anonymous downloads. Please login to continue.${os_1.EOL}`));
                osub = yield (0, Authentication_1.default)();
                useAuthenticated = true;
                // Reset anonymous download count after login
                Preferences_1.default.resetAnonymousDownloadCount();
            }
        }
        const langList = lang.split(",").map((c) => c.trim()).filter(Boolean);
        // Build download tasks (pre-searches for --all-files modes)
        const tasks = yield buildTasks(files, langList, lang);
        if (tasks.length === 0) {
            console.log(chalk.greenBright(`${os_1.EOL}No subtitles to download (all already exist, use --overwrite to re-download).${os_1.EOL}`));
            process.exit(0);
        }
        if (!args.noPrompt) {
            const { confirmed } = yield (0, inquirer_1.prompt)([{
                    type: "confirm",
                    name: "confirmed",
                    message: `About to download ${chalk.bold(tasks.length)} subtitle(s) for ${chalk.bold(files.length)} file(s). Continue?`,
                    default: true,
                }]);
            if (!confirmed) {
                console.log(chalk.yellowBright("Cancelled."));
                process.exit(0);
            }
        }
        const downloadWatcher = new DownloadEventHandler_1.default(tasks.length);
        for (const task of tasks) {
            executeDownloadTask(task)
                .then(dn => downloadWatcher.successHandler(dn))
                .catch(downloadWatcher.errorHandler);
        }
        const result = yield downloadWatcher.finishAll();
        // If anonymous quota was exhausted mid-batch, prompt for login and retry failed downloads
        const isQuotaError = (msg) => msg.includes("allowed") && msg.includes("subtitles") ||
            msg.includes("quota") && msg.toLowerCase().includes("download");
        const quotaErrors = result.err.filter(e => isQuotaError(e.message));
        if (quotaErrors.length > 0 && !useAuthenticated) {
            console.log(chalk.yellowBright(`${os_1.EOL}Anonymous quota exhausted. ${quotaErrors.length} subtitle(s) could not be downloaded.`));
            console.log(chalk.yellowBright(`Please login to retry them.${os_1.EOL}`));
            try {
                osub = yield (0, Authentication_1.default)();
                useAuthenticated = true;
                Preferences_1.default.resetAnonymousDownloadCount();
                quota = -Infinity;
                const failedDisplayNames = new Set(quotaErrors.map(e => e.fileName));
                result.err = result.err.filter(e => !failedDisplayNames.has(e.fileName));
                const retryTasks = tasks.filter(t => failedDisplayNames.has(t.displayName));
                const retryWatcher = new DownloadEventHandler_1.default(retryTasks.length);
                for (const task of retryTasks) {
                    executeDownloadTask(task)
                        .then(dn => retryWatcher.successHandler(dn))
                        .catch(retryWatcher.errorHandler);
                }
                const retryResult = yield retryWatcher.finishAll();
                result.success.push(...retryResult.success);
                result.err.push(...retryResult.err);
            }
            catch (e) {
                result.err.push(...quotaErrors);
                console.log(chalk.redBright(`Login cancelled or failed. ${quotaErrors.length} subtitle(s) were not downloaded.${os_1.EOL}`));
            }
        }
        printResult(result);
        if (quota > -1) {
            console.log(chalk.yellowBright(`${os_1.EOL}OpenSubtitle.com download quota: ${chalk.bold(quota)}`));
        }
        process.exit(result.err.length > 0 ? 1 : 0);
    });
}
function printResult(result) {
    if (args.notificationOutput) {
        (0, child_process_1.execSync)(`osascript -e 'display notification "Downloaded ${result.success.length}" with title "Subtitle Download"'`);
        return;
    }
    if (result.success.length > 0) {
        console.log();
        console.log(chalk.bold.green("  SUCCESS:"));
        for (let fileName of result.success) {
            console.log(chalk.green("✔ ") + chalk.greenBright(`${fileName}`));
        }
    }
    if (result.err.length > 0) {
        console.log();
        console.log(chalk.bold.red("  ERRORS:"));
        for (let error of result.err) {
            console.log(chalk.red("✖ ") + chalk.redBright(`${error.fileName} ${chalk.red(error.message)}`));
        }
    }
}
// Sanitize a subtitle file_name: strip extension and invalid chars, return base only.
// Caller appends .[lang].srt
function sanitizeSubBase(raw, fallback) {
    return (raw || fallback)
        .replace(/\.[^.]*$/, "") // strip existing extension
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") // replace invalid chars
        .trim();
}
function buildTasks(files, langList, langStr) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const tasks = [];
        if (args.allFiles) {
            // Pre-search all available subtitles; all results go into a single folder
            // named after the video file, with lang code in each subtitle filename.
            const langs = args.allLanguages ? langList : [langList[0]];
            const spinner = ora(chalk.yellow(`Searching subtitles (0/${files.length})...`)).start();
            let searched = 0;
            for (const file of files) {
                searched++;
                spinner.text = chalk.yellow(`Searching subtitles (${searched}/${files.length})...`);
                const fileBase = (0, path_1.basename)(file).replace(/\.[^.]*$/, "");
                // Single folder for all languages: myfile/
                const folderPath = (0, path_1.join)((0, path_1.dirname)(file), fileBase);
                (0, fs_extra_1.ensureDirSync)(folderPath);
                for (const langCode of langs) {
                    yield rateLimit();
                    let subs;
                    try {
                        subs = yield searchSubtitlesWithRetry(file, langCode);
                    }
                    catch (e) {
                        subs = [];
                    }
                    if (subs.length === 0)
                        continue;
                    for (let i = 0; i < subs.length; i++) {
                        const sub = subs[i];
                        const rawName = (_b = (_a = sub.attributes.files[0]) === null || _a === void 0 ? void 0 : _a.file_name) !== null && _b !== void 0 ? _b : "";
                        // subname.fr.srt
                        const subFileName = `${sanitizeSubBase(rawName, `${fileBase}_${i + 1}`)}.${langCode}.srt`;
                        const outputPath = (0, path_1.join)(folderPath, subFileName);
                        if (!args.overwrite && (0, fs_extra_1.pathExistsSync)(outputPath))
                            continue;
                        tasks.push({ file, lang: langCode, outputPath, displayName: subFileName, subInfo: sub });
                    }
                }
            }
            spinner.stop();
        }
        else {
            // Normal or --all-languages: one task per file × language.
            // Lang code is always included in the output filename: movie.fr.srt
            const langs = args.allLanguages ? langList : [langStr];
            for (const file of files) {
                const fileBase = file.replace(/\.[^.]*$/, "");
                for (const langCode of langs) {
                    const outputPath = `${fileBase}.${langCode}.srt`;
                    if (!args.overwrite && (0, fs_extra_1.pathExistsSync)(outputPath))
                        continue;
                    const displayName = `${(0, path_1.basename)(fileBase)}.${langCode}.srt`;
                    tasks.push({ file, lang: langCode, outputPath, displayName });
                }
            }
        }
        return tasks;
    });
}
function executeDownloadTask(task) {
    return __awaiter(this, void 0, void 0, function* () {
        let sub;
        if (task.subInfo) {
            sub = task.subInfo;
        }
        else {
            yield rateLimit();
            let subs;
            try {
                subs = yield searchSubtitlesWithRetry(task.file, task.lang);
            }
            catch (e) {
                throw new DownloadEventHandler_1.DownloadError(e.message, task.displayName);
            }
            if (subs.length < 1) {
                throw new DownloadEventHandler_1.DownloadError("No subtitles found", task.displayName);
            }
            sub = subs[0];
        }
        try {
            yield rateLimit();
            const downloadInfo = yield directDownloadCallWithRetry(sub.attributes.files[0].file_id, osub);
            if (downloadInfo.remaining !== undefined) {
                quota = downloadInfo.remaining;
            }
            if (!downloadInfo.link) {
                const message = downloadInfo.message || "No download link returned from API";
                const hasToken = osub.token;
                if (!hasToken && downloadInfo.remaining === 0) {
                    Preferences_1.default.anonymousDownloadCount = 5;
                }
                throw new DownloadEventHandler_1.DownloadError(message, task.displayName);
            }
            yield (0, Util_1.downloadFile)(downloadInfo.link, task.outputPath, false);
            const hasToken = osub.token;
            if (!hasToken && Preferences_1.default.anonymousDownloadCount < 5) {
                Preferences_1.default.incrementAnonymousDownloadCount();
            }
        }
        catch (e) {
            throw new DownloadEventHandler_1.DownloadError(e.message, task.displayName);
        }
        return task.displayName;
    });
}
function searchSubtitlesWithRetry(videoFile_1, lang_1) {
    return __awaiter(this, arguments, void 0, function* (videoFile, lang, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return yield searchSubtitles(videoFile, lang);
            }
            catch (e) {
                const is429 = e.message && e.message.includes('429');
                const is503 = e.message && e.message.includes('503');
                if ((is429 || is503) && attempt < retries) {
                    (0, DebugLogger_1.debugLog)(`[RETRY] ${is429 ? '429' : '503'} on search, sleeping 500ms then re-queuing (attempt ${attempt}/${retries})`);
                    yield new Promise(resolve => setTimeout(resolve, 500));
                    yield rateLimit();
                    continue;
                }
                throw e;
            }
        }
        throw new Error('Max retries exceeded');
    });
}
function directDownloadCallWithRetry(file_id_1, client_1) {
    return __awaiter(this, arguments, void 0, function* (file_id, client, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return yield directDownloadCall(file_id, client);
            }
            catch (e) {
                const is429 = e.message && e.message.includes('429');
                const is503 = e.message && e.message.includes('503');
                if ((is429 || is503) && attempt < retries) {
                    (0, DebugLogger_1.debugLog)(`[RETRY] ${is429 ? '429' : '503'} on download, sleeping 500ms then re-queuing (attempt ${attempt}/${retries})`);
                    yield new Promise(resolve => setTimeout(resolve, 500));
                    yield rateLimit();
                    continue;
                }
                throw e;
            }
        }
        throw new Error('Max retries exceeded');
    });
}
// Direct API call to download endpoint — async (non-blocking) so the event loop stays
// free for spinner updates and rate-limiter timers while curl is in flight.
function directDownloadCall(file_id, client) {
    return __awaiter(this, void 0, void 0, function* () {
        const { exec } = require('child_process');
        const { getApiKey } = require('./Config');
        const url = 'https://api.opensubtitles.com/api/v1/download';
        const token = client.token;
        if (args.debug || args.debugRequest || args.debugHeaders) {
            (0, DebugLogger_1.debugLog)(`\n[DEBUG] Direct download API call (using curl)`);
            (0, DebugLogger_1.debugLog)(`URL: ${url}`);
            (0, DebugLogger_1.debugLog)(`file_id: ${file_id}`);
            (0, DebugLogger_1.debugLog)(`Has token: ${token ? 'YES' : 'NO'}`);
            if (args.debugHeaders || args.debug) {
                (0, DebugLogger_1.debugLog)(`Headers:`);
                (0, DebugLogger_1.debugLog)(`  Api-Key: ${getApiKey()}`);
                if (token) {
                    (0, DebugLogger_1.debugLog)(`  Authorization: Bearer ${token.substring(0, 20)}...`);
                }
                else {
                    (0, DebugLogger_1.debugLog)(`  Authorization: (none - using anonymous)`);
                }
            }
        }
        let curlCommand = `curl -s -w "\\n%{http_code}" --request POST --url '${url}' --header 'Api-Key: ${getApiKey()}' --header 'User-Agent: TemporaryUserAgent'`;
        if (token) {
            curlCommand += ` --header 'Authorization: Bearer ${token}'`;
        }
        curlCommand += ` --form 'file_id=${file_id}'`;
        const result = yield new Promise((resolve, reject) => {
            exec(curlCommand, { encoding: 'utf-8' }, (err, stdout) => {
                if (err)
                    reject(err);
                else
                    resolve(stdout);
            });
        });
        const lines = result.trim().split('\n');
        const statusCode = lines[lines.length - 1];
        const body = lines.slice(0, -1).join('\n');
        if (args.debug || args.debugResponse) {
            (0, DebugLogger_1.debugLog)(`[DEBUG] Download API response (HTTP ${statusCode}):`);
            (0, DebugLogger_1.debugLog)(body);
        }
        if (statusCode === '429') {
            throw new Error('Response code 429 (Too Many Requests)');
        }
        if (statusCode === '503') {
            throw new Error('Response code 503 (Service Unavailable)');
        }
        try {
            return JSON.parse(body);
        }
        catch (e) {
            if (args.debug || args.debugResponse) {
                (0, DebugLogger_1.debugLog)(`[DEBUG] Download API parse error: ${e.message}`);
                (0, DebugLogger_1.debugLog)(`Raw body: ${body}`);
            }
            throw new Error(`Failed to parse download API response: ${e.message}`);
        }
    });
}
function searchSubtitles(videoFile, lang) {
    return __awaiter(this, void 0, void 0, function* () {
        let moviehash;
        try {
            moviehash = (0, MovieHash_1.calculateMovieHash)(videoFile);
            if (args.debug || args.debugRequest) {
                (0, DebugLogger_1.debugLog)(`[DEBUG] Calculated moviehash: ${moviehash}`);
            }
        }
        catch (e) {
            if (args.debug || args.debugRequest) {
                (0, DebugLogger_1.debugLog)(`[DEBUG] Could not calculate moviehash: ${e.message}`);
            }
        }
        // Build search params: all values lowercase, keys sorted alphabetically.
        // The API returns a 301 redirect if params are not in alphabetical order or not lowercase.
        const rawParams = {
            languages: lang.toLowerCase(),
            query: (0, path_1.basename)(videoFile).replace(/\.[^/.]+$/, "").toLowerCase(),
        };
        if (moviehash)
            rawParams.moviehash = moviehash.toLowerCase();
        // Explicit sort guarantees alphabetical key order regardless of insertion order
        const searchParams = Object.fromEntries(Object.entries(rawParams).sort(([a], [b]) => a.localeCompare(b)));
        try {
            const subsFound = yield osub.subtitles(searchParams);
            return subsFound.data || [];
        }
        catch (e) {
            // Check if it's a 429 error from the API
            if (e.statusCode === 429 || (e.message && e.message.includes('429')) || (e.response && e.response.status === 429)) {
                throw new Error('Response code 429 (Too Many Requests)');
            }
            throw e;
        }
    });
}
function getLanguage() {
    var _a, _b;
    const rawLang = (_b = (_a = args.lang) !== null && _a !== void 0 ? _a : Preferences_1.default.lang) !== null && _b !== void 0 ? _b : "en";
    // Multi-language: comma-separated list saved by --set-languages
    const parts = rawLang.split(",").map((c) => c.trim()).filter(Boolean);
    if (parts.length > 1) {
        const isDefault = !args.saveLang;
        console.log(chalk.greenBright(`Languages: ${chalk.yellow(parts.join(", "))}` +
            (isDefault ? `. To save as default add ${chalk.blueBright("-s")} option` : " as default") +
            os_1.EOL));
        if (args.saveLang)
            Preferences_1.default.lang = parts.join(",");
        return parts.join(",");
    }
    const code = parts[0];
    // Try to look up via langs.json (handles alpha3 backward compat, e.g. "eng" → "en")
    const isoLang = (0, Util_1.getLang)(code);
    if (isoLang !== null) {
        const isDefault = (isoLang.alpha2 !== Preferences_1.default.lang && isoLang.alpha3 !== Preferences_1.default.lang && !args.saveLang);
        console.log(chalk.greenBright(`Language set to ${chalk.yellow(isoLang.name)}` +
            (isDefault ? `. To save as default add ${chalk.blueBright("-s")} option` : " as default") +
            os_1.EOL));
        if (args.saveLang)
            Preferences_1.default.lang = isoLang.alpha2;
        return isoLang.alpha2;
    }
    // Not in langs.json — could be an API-specific code (pt-pt, zh-cn, ze, me, ...)
    // Pass it through; the API will return no results if invalid
    if (args.lang) {
        // User passed it explicitly — warn if it looks wrong
        const looksValid = /^[a-z]{2}(-[a-z]{2})?$/.test(code);
        if (!looksValid) {
            console.error(chalk.redBright(`Unknown language code: ${chalk.red(code)}. Run ${chalk.bold("opensubs --set-languages")} to pick from the full list.`));
            process.exit(1);
        }
    }
    const isDefault = (code !== Preferences_1.default.lang && !args.saveLang);
    console.log(chalk.greenBright(`Language: ${chalk.yellow(code)}` +
        (isDefault ? `. To save as default add ${chalk.blueBright("-s")} option` : " as default") +
        os_1.EOL));
    if (args.saveLang)
        Preferences_1.default.lang = code;
    return code;
}
function getPath() {
    let targetPath;
    if (!(0, Util_1.isString)(args.path)) {
        console.error(chalk.redBright.bold(`No path specified!${os_1.EOL}`));
        console.log(args.parser.helpInformation());
        process.exit(0);
    }
    if ((0, path_1.isAbsolute)(args.path)) {
        targetPath = args.path;
    }
    else {
        targetPath = (0, path_1.join)(process.cwd(), args.path);
    }
    if (!(0, fs_extra_1.pathExistsSync)(targetPath)) {
        console.error(chalk.redBright(`Path '${chalk.bold.red(targetPath)}' doesn't exist`));
        process.exit(0);
    }
    return targetPath;
}
function getFiles(targetPath) {
    let files = [];
    const lstatRes = (0, fs_extra_1.lstatSync)(targetPath);
    if (lstatRes.isFile() && isVideoFile(targetPath)) {
        files = [targetPath];
    }
    else if (lstatRes.isDirectory()) {
        // Recursively search for video files in all subdirectories
        files = getVideoFilesRecursive(targetPath);
    }
    const totalVideoFiles = files.length;
    // buildTasks() handles per-task overwrite checks using the actual output path
    // (which now always includes the language code, e.g. movie.fr.srt).
    return { files, totalVideoFiles, skippedFiles: 0 };
}
function getVideoFilesRecursive(dir) {
    let videoFiles = [];
    const entries = (0, fs_extra_1.readdirSync)(dir);
    for (const entry of entries) {
        const fullPath = (0, path_1.join)(dir, entry);
        try {
            const stat = (0, fs_extra_1.lstatSync)(fullPath);
            if (stat.isDirectory()) {
                // Recursively search subdirectories
                videoFiles = videoFiles.concat(getVideoFilesRecursive(fullPath));
            }
            else if (stat.isFile() && isVideoFile(entry)) {
                videoFiles.push(fullPath);
            }
        }
        catch (e) {
            // Skip files/directories that can't be accessed
            continue;
        }
    }
    return videoFiles;
}
function isVideoFile(path) {
    var _a;
    const ext = (_a = path.split(".").pop()) !== null && _a !== void 0 ? _a : null;
    return extensions.indexOf(ext) > -1;
}
const extensions = JSON.parse((0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, "../extensions.json"), { encoding: "utf8" }));
start().catch(e => console.error(e));
//# sourceMappingURL=Run.js.map