"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = parse;
const commander = require("commander");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const os_1 = require("os");
const chalk = require("chalk");
function parse() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const pack = (0, fs_extra_1.readJsonSync)((0, path_1.join)(__dirname, "../package.json"));
    const program = new commander.Command("opensubs");
    program.version(pack.version);
    program.option("-c, --config", "show current configuration and exit");
    program.option("-I, --info", "query the OpenSubtitles API for your account information");
    program.option("--set-languages", "interactively fetch and set default language(s) from the OpenSubtitles language list");
    program.option("-l, --lang <value>", "language code(s) for subtitles, e.g. en or en,fr,de (default: en)");
    program.option("-L, --all-languages", "download the best subtitle for each language in your list, saved as file.lang.srt");
    program.option("-F, --all-files", "download ALL subtitle results (not just the best) into a subfolder named after the video file");
    program.option("-o, --overwrite", "overwrite existing subtitles", false);
    program.option("-s, --save-lang", "save the current language as default");
    program.option("-N, --no-prompt", "the app will not prompt for any user input");
    program.option("-d, --debug", "enable all debug output (requests, responses, headers)");
    program.option("--debug-request", "show debug output for API method calls and parameters");
    program.option("--debug-response", "show debug output for API responses");
    program.option("--debug-headers", "show debug output for HTTP headers only");
    if ((0, os_1.platform)() === "darwin") {
        program.option("-n, --notification-output", "show output as a notification");
    }
    program.usage("<path> [options]");
    // Override Commander's default help with a grouped, colored layout.
    // Column width: widest flag is "-n, --notification-output" (25 chars), pad to 28.
    const col = (flag, desc) => `  ${chalk.cyan(flag.padEnd(28))}${desc}`;
    const isDarwin = (0, os_1.platform)() === "darwin";
    program.helpInformation = function () {
        return [
            "",
            `  Usage: ${chalk.bold("opensubs")} <path> [options]`,
            "",
            chalk.bold("  Info:"),
            col("-V, --version", "output the version number"),
            col("-c, --config", "show current configuration and exit"),
            col("-I, --info", "show your OpenSubtitles account info from the API"),
            col("--set-languages", "interactively set default language(s) from the API list"),
            col("-h, --help", "display help for command"),
            "",
            chalk.bold("  Download:"),
            col("-l, --lang <value>", `language code(s), e.g. ${chalk.yellow("en")} or ${chalk.yellow("en,fr,de")}  (default: en)`),
            col("-L, --all-languages", `best subtitle per language  → ${chalk.dim("movie.fr.srt, movie.en.srt")}`),
            col("-F, --all-files", `all results into a subfolder  → ${chalk.dim("movie/subname.fr.srt")}`),
            col("-o, --overwrite", "overwrite existing subtitles"),
            col("-s, --save-lang", "save language as default"),
            "",
            chalk.bold("  Options:"),
            col("-N, --no-prompt", "never prompt for user input"),
            isDarwin ? col("-n, --notification-output", "show output as a macOS notification") : null,
            "",
            chalk.bold("  Debug:"),
            col("-d, --debug", "enable all debug output (requests, responses, headers)"),
            col("--debug-request", "show debug output for API requests"),
            col("--debug-response", "show debug output for API responses"),
            col("--debug-headers", "show debug output for HTTP headers"),
            "",
        ].filter(l => l !== null).join("\n") + "\n";
    };
    program.parse(process.argv);
    return {
        lang: program.lang,
        username: program.username,
        password: program.password,
        overwrite: (_a = program.overwrite) !== null && _a !== void 0 ? _a : false,
        saveLang: (_b = program.saveLang) !== null && _b !== void 0 ? _b : false,
        path: program.args[0],
        parser: program,
        info: (_c = program.info) !== null && _c !== void 0 ? _c : false,
        notificationOutput: (_d = program.notificationOutput) !== null && _d !== void 0 ? _d : false,
        noPrompt: (_e = program.noPrompt) !== null && _e !== void 0 ? _e : false,
        debug: (_f = program.debug) !== null && _f !== void 0 ? _f : false,
        debugRequest: (_g = program.debugRequest) !== null && _g !== void 0 ? _g : false,
        debugResponse: (_h = program.debugResponse) !== null && _h !== void 0 ? _h : false,
        debugHeaders: (_j = program.debugHeaders) !== null && _j !== void 0 ? _j : false,
        config: (_k = program.config) !== null && _k !== void 0 ? _k : false,
        setLanguages: (_l = program.setLanguages) !== null && _l !== void 0 ? _l : false,
        allLanguages: (_m = program.allLanguages) !== null && _m !== void 0 ? _m : false,
        allFiles: (_o = program.allFiles) !== null && _o !== void 0 ? _o : false,
    };
}
//# sourceMappingURL=ArgPars.js.map