#!/usr/bin/env node

import {join,isAbsolute,basename,dirname} from "path"
import {readFileSync, pathExistsSync, lstatSync, readdirSync, ensureDirSync} from "fs-extra"
import * as ora from "ora"
import parseArguments from "./ArgPars"
import * as chalk from "chalk";
import * as keytar from "keytar";
import Preferences, {PREF_FILE} from "./Preferences";
import authenticate, {createAnonymousClient, createAuthenticatedClient} from "./Authentication";
import {downloadFile, getLang, isString, fetchApiLanguages, fetchUserInfo} from "./Util";
import {prompt} from "inquirer";
import DownloadEventHandler, {DownloadError, DownloadResult} from "./DownloadEventHandler";
import {IOpenSubtitles, ISubInfo} from "./Types";
import {EOL} from "os"
import {execSync} from "child_process";
import {enableDebug, interceptHTTPS, debugLog} from "./DebugLogger";
import {calculateMovieHash} from "./MovieHash";

const args=parseArguments();

// Enable debug mode if requested
if (args.debug || args.debugRequest || args.debugResponse || args.debugHeaders) {
	const debugOptions = {
		request: args.debug || args.debugRequest,
		response: args.debug || args.debugResponse,
		headers: args.debug || args.debugHeaders
	};

	enableDebug(debugOptions);
	interceptHTTPS();
}

interface DownloadTask {
	file: string;        // source video file path
	lang: string;        // single language code
	outputPath: string;  // where to save the .srt
	displayName: string; // shown in success/error output
	subInfo?: ISubInfo;  // pre-fetched for --all-files modes
}

let osub:IOpenSubtitles;

let quota:number=-Infinity;

// Rate limiting: promise-chain queue that spaces every API call by RATE_LIMIT_DELAY_MS.
// This avoids the race-condition in a simple lastRequestTime check — multiple concurrent
// callers each atomically grab the current chain tail and chain off it, so they form a
// strict FIFO queue with guaranteed minimum spacing between requests.
// The API allows 5 req/s; we use 350 ms (~2.8 req/s) to stay safely under that.
const RATE_LIMIT_DELAY_MS = 350;
let rateLimitChain: Promise<void> = Promise.resolve();

async function rateLimit(): Promise<void> {
	let resolveSlot!: () => void;
	const mySlot = new Promise<void>(r => { resolveSlot = r; });

	// Atomically take the current tail and replace it with ours.
	// Because JS is single-threaded, nothing can interleave between these two lines.
	const previousSlot = rateLimitChain;
	rateLimitChain = mySlot;

	// Wait for everyone ahead of us to finish their delay
	await previousSlot;

	// Give the next caller their turn after our delay
	setTimeout(resolveSlot, RATE_LIMIT_DELAY_MS);
	// (we ourselves proceed immediately — the delay only gates the *next* caller)
}

async function handleSetLanguages(){
	await Preferences.loadPreferences();

	process.stdout.write(chalk.yellow("Fetching language list from OpenSubtitles.com..."));
	let languages: {language_code: string; language_name: string}[];
	try {
		languages = await fetchApiLanguages();
		process.stdout.write(" done.\n\n");
	} catch(e) {
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

	const {input} = await prompt([{
		type: "input",
		name: "input",
		message: "Enter language code(s) separated by commas (e.g. en,fr,de):",
		validate: (val: string) => {
			const codes = val.split(",").map(c => c.trim()).filter(Boolean);
			if (codes.length === 0) return "Please enter at least one language code.";
			const invalid = codes.filter(c => !availableCodes.has(c));
			if (invalid.length > 0) return `Invalid code(s): ${invalid.join(", ")}. Check the list above.`;
			return true;
		}
	}]);

	const codes: string[] = input.split(",").map((c: string) => c.trim()).filter(Boolean);
	Preferences.lang = codes.join(",");

	const names = codes
		.map((c: string) => languages.find(l => l.language_code === c)?.language_name ?? c)
		.join(", ");
	console.log(chalk.greenBright(`\nDefault language(s) set to: ${chalk.bold(names)} (${chalk.cyan(codes.join(","))})\n`));
}

async function showConfig(){
	await Preferences.loadPreferences();

	const accounts: {account:string; password:string}[] = await keytar.findCredentials("opensubtitles.com");
	const savedAccount = Preferences.account;
	const matchedAccount = accounts.find(a => a.account === savedAccount) ?? accounts[0] ?? null;

	const savedToken = Preferences.getToken();
	let tokenStatus: string;
	if (!savedToken) {
		tokenStatus = chalk.gray("(none)");
	} else if (Preferences.isTokenExpired(savedToken)) {
		tokenStatus = chalk.redBright("expired");
	} else {
		tokenStatus = chalk.greenBright("valid");
	}

	const line = chalk.cyan("─".repeat(44));
	console.log();
	console.log(chalk.bold.cyan("  OpenSubs CLI Configuration"));
	console.log(line);
	console.log(`  Config file : ${chalk.yellow(PREF_FILE)}`);
	console.log(`  Username    : ${matchedAccount ? chalk.greenBright(matchedAccount.account) : chalk.gray("(not set)")}`);
	console.log(`  Password    : ${matchedAccount ? chalk.greenBright("*****") + chalk.gray(" (stored in system keychain)") : chalk.gray("(not set)")}`);
	console.log(`  Language    : ${Preferences.lang ? chalk.greenBright(Preferences.lang) : chalk.gray("(not set — defaults to eng)")}`);
	console.log(`  Anon quota  : ${chalk.yellow(Preferences.anonymousDownloadCount + "/5")} downloads used`);
	console.log(`  Auth token  : ${tokenStatus}`);
	console.log(line);
	console.log();
}

async function handleInfo(){
	await Preferences.loadPreferences();

	const savedToken = Preferences.getToken();
	const isAuthenticated = !!savedToken && !Preferences.isTokenExpired(savedToken);

	const spinner = ora(chalk.yellow("Fetching account info...")).start();
	let info;
	try {
		info = await fetchUserInfo(isAuthenticated ? savedToken : null);
		spinner.stop();
	} catch(e) {
		spinner.stop();
		console.error(chalk.redBright(`Failed to fetch user info: ${e.message}`));
		process.exit(1);
	}

	const line = chalk.cyan("─".repeat(44));
	const yesNo = (v: boolean) => v ? chalk.greenBright("Yes") : chalk.gray("No");

	console.log();
	console.log(chalk.bold.cyan("  OpenSubs — Account Info"));
	console.log(line);
	if (info.username)           console.log(`  Username           : ${chalk.greenBright(info.username)}`);
	console.log(                 `  Level              : ${chalk.yellow(info.level)}`);
	if (info.user_id)            console.log(`  User ID            : ${chalk.white(String(info.user_id))}`);
	console.log(                 `  Allowed downloads  : ${chalk.yellow(String(info.allowed_downloads))}`);
	if (info.remaining_downloads !== undefined)
		console.log(             `  Remaining today    : ${chalk.yellow(String(info.remaining_downloads))}`);
	if (info.downloads_count !== undefined)
		console.log(             `  Downloads used     : ${chalk.yellow(String(info.downloads_count))}`);
	console.log(                 `  VIP                : ${yesNo(info.vip)}`);
	console.log(                 `  Authenticated      : ${yesNo(isAuthenticated)}`);
	console.log(line);
	console.log();
}

async function start(){
	if(args.config){
		await showConfig();
		return;
	}

	if(args.info){
		await handleInfo();
		return;
	}

	if(args.setLanguages){
		await handleSetLanguages();
		return;
	}

	const targetPath=getPath();

	const {files} = getFiles(targetPath);

	if(files.length<1){
		console.log(chalk.yellowBright(`${EOL}No video files found${EOL}`));
		return;
	}

	await Preferences.loadPreferences();

	const lang=getLanguage();

	// Check for saved bearer token first
	const savedToken = Preferences.getToken();
	let useAuthenticated = false;

	if (args.debug || args.debugRequest) {
		debugLog(`[DEBUG] Saved token: ${savedToken ? 'exists' : 'null'}`);
		if (savedToken) {
			debugLog(`[DEBUG] Token expired: ${Preferences.isTokenExpired(savedToken)}`);
		}
	}

	if (savedToken && !Preferences.isTokenExpired(savedToken)) {
		// Use saved token from previous login
		console.log(chalk.greenBright(`Using saved authentication token.${EOL}`));
		osub = await createAuthenticatedClient(savedToken);
		useAuthenticated = true;
		// Reset anonymous download count when using authenticated mode
		Preferences.resetAnonymousDownloadCount();
	} else {
		// Clear expired token if any
		if (savedToken) {
			console.log(chalk.yellowBright(`Saved authentication token has expired.${EOL}`));
			Preferences.clearToken();
		}

		// Check if user can use anonymous mode (less than 5 downloads)
		const anonymousDownloads = Preferences.anonymousDownloadCount;

		if (anonymousDownloads < 5) {
			console.log(chalk.blueBright(`Using anonymous mode (${anonymousDownloads}/5 downloads used). You can download ${5 - anonymousDownloads} more subtitle(s) before needing to login.${EOL}`));
			osub = await createAnonymousClient();
		} else {
			// Anonymous quota exhausted, prompt for login immediately
			console.log(chalk.yellowBright(`You've used your 5 free anonymous downloads. Please login to continue.${EOL}`));
			osub = await authenticate();
			useAuthenticated = true;
			// Reset anonymous download count after login
			Preferences.resetAnonymousDownloadCount();
		}
	}

	const langList = lang.split(",").map((c:string) => c.trim()).filter(Boolean);

	// Build download tasks (pre-searches for --all-files modes)
	const tasks = await buildTasks(files, langList, lang);

	if (tasks.length === 0) {
		console.log(chalk.greenBright(`${EOL}No subtitles to download (all already exist, use --overwrite to re-download).${EOL}`));
		process.exit(0);
	}

	if (!args.noPrompt) {
		const {confirmed} = await prompt([{
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

	const downloadWatcher = new DownloadEventHandler(tasks.length);

	for (const task of tasks) {
		executeDownloadTask(task)
			.then(dn => downloadWatcher.successHandler(dn))
			.catch(downloadWatcher.errorHandler);
	}

	const result = await downloadWatcher.finishAll();

	// If anonymous quota was exhausted mid-batch, prompt for login and retry failed downloads
	const isQuotaError = (msg: string) =>
		msg.includes("allowed") && msg.includes("subtitles") ||
		msg.includes("quota") && msg.toLowerCase().includes("download");

	const quotaErrors = result.err.filter(e => isQuotaError(e.message));

	if (quotaErrors.length > 0 && !useAuthenticated) {
		console.log(chalk.yellowBright(`${EOL}Anonymous quota exhausted. ${quotaErrors.length} subtitle(s) could not be downloaded.`));
		console.log(chalk.yellowBright(`Please login to retry them.${EOL}`));

		try {
			osub = await authenticate();
			useAuthenticated = true;
			Preferences.resetAnonymousDownloadCount();
			quota = -Infinity;

			const failedDisplayNames = new Set(quotaErrors.map(e => e.fileName));
			result.err = result.err.filter(e => !failedDisplayNames.has(e.fileName));

			const retryTasks = tasks.filter(t => failedDisplayNames.has(t.displayName));
			const retryWatcher = new DownloadEventHandler(retryTasks.length);

			for (const task of retryTasks) {
				executeDownloadTask(task)
					.then(dn => retryWatcher.successHandler(dn))
					.catch(retryWatcher.errorHandler);
			}

			const retryResult = await retryWatcher.finishAll();
			result.success.push(...retryResult.success);
			result.err.push(...retryResult.err);
		} catch (e) {
			result.err.push(...quotaErrors);
			console.log(chalk.redBright(`Login cancelled or failed. ${quotaErrors.length} subtitle(s) were not downloaded.${EOL}`));
		}
	}

	printResult(result);

	if (quota > -1) {
		console.log(chalk.yellowBright(`${EOL}OpenSubtitle.com download quota: ${chalk.bold(quota)}`));
	}

	process.exit(result.err.length > 0 ? 1 : 0);
}

function printResult(result:DownloadResult){
	if(args.notificationOutput){
		execSync(`osascript -e 'display notification "Downloaded ${result.success.length}" with title "Subtitle Download"'`);
		return;
	}

	if(result.success.length>0){
		console.log();

		console.log(chalk.bold.green("  SUCCESS:"));
		for(let fileName of result.success){
			console.log(chalk.green("✔ ")+chalk.greenBright(`${fileName}`))
		}
	}

	if(result.err.length>0){
		console.log();

		console.log(chalk.bold.red("  ERRORS:"));
		for(let error of result.err){
			console.log(chalk.red("✖ ")+chalk.redBright(`${error.fileName} ${chalk.red(error.message)}`))
		}
	}
}

// Sanitize a subtitle file_name: strip extension and invalid chars, return base only.
// Caller appends .[lang].srt
function sanitizeSubBase(raw: string, fallback: string): string {
	return (raw || fallback)
		.replace(/\.[^.]*$/, "")          // strip existing extension
		.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") // replace invalid chars
		.trim();
}

async function buildTasks(files: string[], langList: string[], langStr: string): Promise<DownloadTask[]> {
	const tasks: DownloadTask[] = [];

	if (args.allFiles) {
		// Pre-search all available subtitles; all results go into a single folder
		// named after the video file, with lang code in each subtitle filename.
		const langs = args.allLanguages ? langList : [langList[0]];
		const spinner = ora(chalk.yellow(`Searching subtitles (0/${files.length})...`)).start();
		let searched = 0;

		for (const file of files) {
			searched++;
			spinner.text = chalk.yellow(`Searching subtitles (${searched}/${files.length})...`);

			const fileBase = basename(file).replace(/\.[^.]*$/, "");
			// Single folder for all languages: myfile/
			const folderPath = join(dirname(file), fileBase);
			ensureDirSync(folderPath);

			for (const langCode of langs) {
				await rateLimit();
				let subs: ISubInfo[];
				try {
					subs = await searchSubtitlesWithRetry(file, langCode);
				} catch (e) {
					subs = [];
				}
				if (subs.length === 0) continue;

				for (let i = 0; i < subs.length; i++) {
					const sub = subs[i];
					const rawName = sub.attributes.files[0]?.file_name ?? "";
					// subname.fr.srt
					const subFileName = `${sanitizeSubBase(rawName, `${fileBase}_${i + 1}`)}.${langCode}.srt`;
					const outputPath = join(folderPath, subFileName);

					if (!args.overwrite && pathExistsSync(outputPath)) continue;

					tasks.push({ file, lang: langCode, outputPath, displayName: subFileName, subInfo: sub });
				}
			}
		}

		spinner.stop();

	} else {
		// Normal or --all-languages: one task per file × language.
		// Lang code is always included in the output filename: movie.fr.srt
		const langs = args.allLanguages ? langList : [langStr];

		for (const file of files) {
			const fileBase = file.replace(/\.[^.]*$/, "");

			for (const langCode of langs) {
				const outputPath = `${fileBase}.${langCode}.srt`;

				if (!args.overwrite && pathExistsSync(outputPath)) continue;

				const displayName = `${basename(fileBase)}.${langCode}.srt`;

				tasks.push({ file, lang: langCode, outputPath, displayName });
			}
		}
	}

	return tasks;
}

async function executeDownloadTask(task: DownloadTask): Promise<string> {
	let sub: ISubInfo;

	if (task.subInfo) {
		sub = task.subInfo;
	} else {
		await rateLimit();
		let subs: ISubInfo[];
		try {
			subs = await searchSubtitlesWithRetry(task.file, task.lang);
		} catch (e) {
			throw new DownloadError(e.message, task.displayName);
		}
		if (subs.length < 1) {
			throw new DownloadError("No subtitles found", task.displayName);
		}
		sub = subs[0];
	}

	try {
		await rateLimit();
		const downloadInfo = await directDownloadCallWithRetry(sub.attributes.files[0].file_id, osub);

		if (downloadInfo.remaining !== undefined) {
			quota = downloadInfo.remaining;
		}

		if (!downloadInfo.link) {
			const message = downloadInfo.message || "No download link returned from API";
			const hasToken = (osub as any).token;
			if (!hasToken && downloadInfo.remaining === 0) {
				Preferences.anonymousDownloadCount = 5;
			}
			throw new DownloadError(message, task.displayName);
		}

		await downloadFile(downloadInfo.link, task.outputPath, false);

		const hasToken = (osub as any).token;
		if (!hasToken && Preferences.anonymousDownloadCount < 5) {
			Preferences.incrementAnonymousDownloadCount();
		}
	} catch (e) {
		throw new DownloadError(e.message, task.displayName);
	}

	return task.displayName;
}

async function searchSubtitlesWithRetry(videoFile: string, lang: string, retries = 3): Promise<ISubInfo[]> {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			return await searchSubtitles(videoFile, lang);
		} catch (e) {
			const is429 = e.message && e.message.includes('429');
			const is503 = e.message && e.message.includes('503');
			if ((is429 || is503) && attempt < retries) {
				debugLog(`[RETRY] ${is429 ? '429' : '503'} on search, sleeping 500ms then re-queuing (attempt ${attempt}/${retries})`);
				await new Promise(resolve => setTimeout(resolve, 500));
				await rateLimit();
				continue;
			}
			throw e;
		}
	}
	throw new Error('Max retries exceeded');
}

async function directDownloadCallWithRetry(file_id: number, client: IOpenSubtitles, retries = 3): Promise<{ link?: string; remaining?: number; message?: string; requests?: number }> {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			return await directDownloadCall(file_id, client);
		} catch (e) {
			const is429 = e.message && e.message.includes('429');
			const is503 = e.message && e.message.includes('503');
			if ((is429 || is503) && attempt < retries) {
				debugLog(`[RETRY] ${is429 ? '429' : '503'} on download, sleeping 500ms then re-queuing (attempt ${attempt}/${retries})`);
				await new Promise(resolve => setTimeout(resolve, 500));
				await rateLimit();
				continue;
			}
			throw e;
		}
	}
	throw new Error('Max retries exceeded');
}


// Direct API call to download endpoint — async (non-blocking) so the event loop stays
// free for spinner updates and rate-limiter timers while curl is in flight.
async function directDownloadCall(file_id: number, client: IOpenSubtitles): Promise<{ link?: string; remaining?: number; message?: string; requests?: number }> {
	const {exec} = require('child_process');
	const {getApiKey} = require('./Config');

	const url = 'https://api.opensubtitles.com/api/v1/download';
	const token = (client as any).token;

	if (args.debug || args.debugRequest || args.debugHeaders) {
		debugLog(`\n[DEBUG] Direct download API call (using curl)`);
		debugLog(`URL: ${url}`);
		debugLog(`file_id: ${file_id}`);
		debugLog(`Has token: ${token ? 'YES' : 'NO'}`);
		if (args.debugHeaders || args.debug) {
			debugLog(`Headers:`);
			debugLog(`  Api-Key: ${getApiKey()}`);
			if (token) {
				debugLog(`  Authorization: Bearer ${token.substring(0, 20)}...`);
			} else {
				debugLog(`  Authorization: (none - using anonymous)`);
			}
		}
	}

	let curlCommand = `curl -s -w "\\n%{http_code}" --request POST --url '${url}' --header 'Api-Key: ${getApiKey()}' --header 'User-Agent: TemporaryUserAgent'`;
	if (token) {
		curlCommand += ` --header 'Authorization: Bearer ${token}'`;
	}
	curlCommand += ` --form 'file_id=${file_id}'`;

	const result = await new Promise<string>((resolve, reject) => {
		exec(curlCommand, {encoding: 'utf-8'}, (err: Error | null, stdout: string) => {
			if (err) reject(err);
			else resolve(stdout);
		});
	});

	const lines = result.trim().split('\n');
	const statusCode = lines[lines.length - 1];
	const body = lines.slice(0, -1).join('\n');

	if (args.debug || args.debugResponse) {
		debugLog(`[DEBUG] Download API response (HTTP ${statusCode}):`);
		debugLog(body);
	}

	if (statusCode === '429') {
		throw new Error('Response code 429 (Too Many Requests)');
	}

	if (statusCode === '503') {
		throw new Error('Response code 503 (Service Unavailable)');
	}

	try {
		return JSON.parse(body);
	} catch (e) {
		if (args.debug || args.debugResponse) {
			debugLog(`[DEBUG] Download API parse error: ${e.message}`);
			debugLog(`Raw body: ${body}`);
		}
		throw new Error(`Failed to parse download API response: ${e.message}`);
	}
}

async function searchSubtitles(videoFile:string,lang:string):Promise<ISubInfo[]>{
	let moviehash: string | undefined;

	try {
		moviehash = calculateMovieHash(videoFile);
		if (args.debug || args.debugRequest) {
			debugLog(`[DEBUG] Calculated moviehash: ${moviehash}`);
		}
	} catch (e) {
		if (args.debug || args.debugRequest) {
			debugLog(`[DEBUG] Could not calculate moviehash: ${e.message}`);
		}
	}

	// Build search params: all values lowercase, keys sorted alphabetically.
	// The API returns a 301 redirect if params are not in alphabetical order or not lowercase.
	const rawParams: Record<string, string> = {
		languages: lang.toLowerCase(),
		query: basename(videoFile).replace(/\.[^/.]+$/, "").toLowerCase(),
	};
	if (moviehash) rawParams.moviehash = moviehash.toLowerCase();

	// Explicit sort guarantees alphabetical key order regardless of insertion order
	const searchParams = Object.fromEntries(
		Object.entries(rawParams).sort(([a], [b]) => a.localeCompare(b))
	);

	try {
		const subsFound = await osub.subtitles(searchParams);
		return subsFound.data || [];
	} catch (e) {
		// Check if it's a 429 error from the API
		if (e.statusCode === 429 || (e.message && e.message.includes('429')) || (e.response && e.response.status === 429)) {
			throw new Error('Response code 429 (Too Many Requests)');
		}
		throw e;
	}
}
function getLanguage():string{
	const rawLang = args.lang ?? Preferences.lang ?? "en";

	// Multi-language: comma-separated list saved by --set-languages
	const parts = rawLang.split(",").map((c:string) => c.trim()).filter(Boolean);
	if(parts.length > 1){
		const isDefault = !args.saveLang;
		console.log(chalk.greenBright(
			`Languages: ${chalk.yellow(parts.join(", "))}` +
			(isDefault ? `. To save as default add ${chalk.blueBright("-s")} option` : " as default") +
			EOL
		));
		if(args.saveLang) Preferences.lang = parts.join(",");
		return parts.join(",");
	}

	const code = parts[0];

	// Try to look up via langs.json (handles alpha3 backward compat, e.g. "eng" → "en")
	const isoLang = getLang(code);
	if(isoLang !== null){
		const isDefault = (isoLang.alpha2 !== Preferences.lang && isoLang.alpha3 !== Preferences.lang && !args.saveLang);
		console.log(chalk.greenBright(
			`Language set to ${chalk.yellow(isoLang.name)}` +
			(isDefault ? `. To save as default add ${chalk.blueBright("-s")} option` : " as default") +
			EOL
		));
		if(args.saveLang) Preferences.lang = isoLang.alpha2;
		return isoLang.alpha2;
	}

	// Not in langs.json — could be an API-specific code (pt-pt, zh-cn, ze, me, ...)
	// Pass it through; the API will return no results if invalid
	if(args.lang){
		// User passed it explicitly — warn if it looks wrong
		const looksValid = /^[a-z]{2}(-[a-z]{2})?$/.test(code);
		if(!looksValid){
			console.error(chalk.redBright(`Unknown language code: ${chalk.red(code)}. Run ${chalk.bold("opensubs --set-languages")} to pick from the full list.`));
			process.exit(1);
		}
	}

	const isDefault = (code !== Preferences.lang && !args.saveLang);
	console.log(chalk.greenBright(
		`Language: ${chalk.yellow(code)}` +
		(isDefault ? `. To save as default add ${chalk.blueBright("-s")} option` : " as default") +
		EOL
	));
	if(args.saveLang) Preferences.lang = code;
	return code;
}

function getPath():string{

	let targetPath:string;

	if(!isString(args.path)){
		console.error(chalk.redBright.bold(`No path specified!${EOL}`));
		console.log(args.parser.helpInformation());
		process.exit(0);
	}

	if(isAbsolute(args.path)){
		targetPath=args.path;
	}else{
		targetPath=join(process.cwd(),args.path);
	}

	if(!pathExistsSync(targetPath)){
		console.error(chalk.redBright(`Path '${chalk.bold.red(targetPath)}' doesn't exist`));
		process.exit(0);
	}

	return targetPath;
}

function getFiles(targetPath:string):{files: string[], totalVideoFiles: number, skippedFiles: number}{
	let files:string[]=[];

	const lstatRes=lstatSync(targetPath);
	if(lstatRes.isFile() && isVideoFile(targetPath)){
		files=[targetPath];
	}else if(lstatRes.isDirectory()){
		// Recursively search for video files in all subdirectories
		files = getVideoFilesRecursive(targetPath);
	}

	const totalVideoFiles = files.length;

	// buildTasks() handles per-task overwrite checks using the actual output path
	// (which now always includes the language code, e.g. movie.fr.srt).

	return {files, totalVideoFiles, skippedFiles: 0};
}

function getVideoFilesRecursive(dir:string):string[]{
	let videoFiles:string[]=[];

	const entries=readdirSync(dir);
	for(const entry of entries){
		const fullPath=join(dir,entry);
		try{
			const stat=lstatSync(fullPath);
			if(stat.isDirectory()){
				// Recursively search subdirectories
				videoFiles=videoFiles.concat(getVideoFilesRecursive(fullPath));
			}else if(stat.isFile() && isVideoFile(entry)){
				videoFiles.push(fullPath);
			}
		}catch(e){
			// Skip files/directories that can't be accessed
			continue;
		}
	}

	return videoFiles;
}

function isVideoFile(path:string){
	const ext=path.split(".").pop() ?? null;

	return extensions.indexOf(ext)>-1;
}

const extensions:string[]=JSON.parse(
	readFileSync(
		join(__dirname,"../extensions.json"),{encoding:"utf8"}
	)
);

start().catch(e=>console.error(e));
