"use strict";
/**
 * Authentication module for OpenSubtitles.com
 *
 * CREDENTIAL STORAGE:
 * - Credentials are stored securely using the 'keytar' library
 * - macOS: Stored in Keychain (accessible via Keychain Access app)
 * - Windows: Stored in Credential Manager (accessible via Control Panel)
 * - Linux: Stored using libsecret (Secret Service API)
 * - Service name: "opensubtitles.com"
 * - Account: Your OpenSubtitles.com username
 *
 * To remove stored credentials:
 * - macOS: Open Keychain Access > Search "opensubtitles.com" > Delete
 * - Windows: Control Panel > Credential Manager > Windows Credentials > Remove
 * - Linux: Use seahorse or secret-tool to remove the credential
 */
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
exports.createAnonymousClient = createAnonymousClient;
exports.createAuthenticatedClient = createAuthenticatedClient;
exports.default = authenticate;
const keytar = require("keytar");
const chalk = require("chalk");
const inquirer_1 = require("inquirer");
const Util_1 = require("./Util");
const OpenSubtitles = require("opensubtitles.com");
const ora = require("ora");
const Preferences_1 = require("./Preferences");
const os_1 = require("os");
const Config_1 = require("./Config");
const DebugWrapper_1 = require("./DebugWrapper");
const DebugLogger_1 = require("./DebugLogger");
function createAnonymousClient() {
    return __awaiter(this, void 0, void 0, function* () {
        const osub = new OpenSubtitles({
            apikey: (0, Config_1.getApiKey)(),
            useragent: "opensubs-cli v" + require("../package.json").version
        });
        // Wrap with debug logger if debug mode is enabled
        if ((0, DebugLogger_1.isDebugEnabled)()) {
            const options = (0, DebugLogger_1.getDebugOptions)();
            (0, DebugWrapper_1.setDebugWrapperOptions)({ request: options.request, response: options.response });
            return (0, DebugWrapper_1.createDebugWrapper)(osub);
        }
        return osub;
    });
}
function createAuthenticatedClient(token) {
    return __awaiter(this, void 0, void 0, function* () {
        const osub = new OpenSubtitles({
            apikey: (0, Config_1.getApiKey)(),
            useragent: "opensubs-cli v" + require("../package.json").version
        });
        // Set the token on the client
        osub.token = token;
        // Wrap with debug logger if debug mode is enabled
        if ((0, DebugLogger_1.isDebugEnabled)()) {
            const options = (0, DebugLogger_1.getDebugOptions)();
            (0, DebugWrapper_1.setDebugWrapperOptions)({ request: options.request, response: options.response });
            return (0, DebugWrapper_1.createDebugWrapper)(osub);
        }
        return osub;
    });
}
function authenticate() {
    return __awaiter(this, void 0, void 0, function* () {
        let accounts = yield keytar.findCredentials("opensubtitles.com");
        return getCredentialsRec(accounts);
    });
}
function getCredentialsRec(accounts_1) {
    return __awaiter(this, arguments, void 0, function* (accounts, triedAccounts = [], firstPass = true) {
        let credentials = null;
        const validAccounts = accounts.filter(acc => triedAccounts.indexOf(acc.account) < 0);
        if (validAccounts.length > 0) {
            if (firstPass && accounts.findIndex(acc => acc.account === Preferences_1.default.account) > -1) {
                credentials = accounts.find(acc => acc.account === Preferences_1.default.account);
            }
            else {
                credentials = yield inquireAccount(validAccounts);
            }
            if (credentials !== null) {
                triedAccounts.push(credentials.account);
            }
        }
        if (credentials === null) {
            if (firstPass) {
                console.log(chalk.yellowBright("No account found for opensubtitles.com"));
                console.log(chalk.yellowBright("You will be prompted to add your credentials for opensubtitles.com. This information is stored securely by your OS"));
            }
            console.log();
            credentials = yield inquireCredentials();
        }
        // Clean password if it contains the old pipe separator (from previous versions)
        if (credentials.password.includes("|")) {
            const parts = credentials.password.split("|");
            credentials.password = parts[0];
        }
        let osub = yield tryCredentials(credentials);
        if (osub !== null) {
            yield keytar.setPassword("opensubtitles.com", credentials.account, credentials.password);
            Preferences_1.default.account = credentials.account;
            // Save the bearer token for future sessions
            const token = osub.token;
            if (token) {
                Preferences_1.default.saveToken(token);
            }
            return osub;
        }
        else {
            return getCredentialsRec(accounts, triedAccounts, false);
        }
    });
}
function tryCredentials(credentials) {
    return __awaiter(this, void 0, void 0, function* () {
        const spinner = ora(chalk.yellow(`Logging in ${credentials.account}`)).start();
        try {
            // Direct API call to login endpoint using curl (library incorrectly uses GET instead of POST)
            const loginResponse = yield directLoginCall(credentials.account, credentials.password);
            if (!loginResponse.token) {
                const message = loginResponse.message || "No token returned from API";
                throw new Error(message);
            }
            spinner.succeed(`Successfully logged in as ${chalk.blueBright(credentials.account)}`);
            // Create client with the token
            const osub = new OpenSubtitles({
                apikey: (0, Config_1.getApiKey)(),
                useragent: "opensubs-cli v" + require("../package.json").version
            });
            // Set the token on the client
            osub.token = loginResponse.token;
            // Wrap with debug logger if debug mode is enabled
            if ((0, DebugLogger_1.isDebugEnabled)()) {
                const options = (0, DebugLogger_1.getDebugOptions)();
                (0, DebugWrapper_1.setDebugWrapperOptions)({ request: options.request, response: options.response });
                return (0, DebugWrapper_1.createDebugWrapper)(osub);
            }
            return osub;
        }
        catch (e) {
            // console.error(e);
            spinner.fail(`Failed to log in as ${chalk.blueBright(credentials.account)}. Error: ${chalk.redBright(e.message)}`);
            return null;
        }
    });
}
// Direct API call to login endpoint using curl (library incorrectly uses GET instead of POST)
function directLoginCall(username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        const { execSync } = require('child_process');
        const url = 'https://api.opensubtitles.com/api/v1/login';
        if ((0, DebugLogger_1.isDebugEnabled)()) {
            const options = (0, DebugLogger_1.getDebugOptions)();
            if (options.request) {
                (0, DebugLogger_1.debugLog)(`\n[DEBUG] Direct login API call (using curl)`);
                (0, DebugLogger_1.debugLog)(`URL: ${url}`);
                (0, DebugLogger_1.debugLog)(`username: ${username}`);
            }
        }
        try {
            const curlCommand = `curl -s --request POST --url '${url}' --header 'Api-Key: ${(0, Config_1.getApiKey)()}' --header 'Content-Type: application/json' --header 'User-Agent: opensubs-cli v${require("../package.json").version}' --data '{"username":"${username}","password":"${password}"}'`;
            const result = execSync(curlCommand, { encoding: 'utf-8' });
            if ((0, DebugLogger_1.isDebugEnabled)()) {
                const options = (0, DebugLogger_1.getDebugOptions)();
                if (options.response) {
                    (0, DebugLogger_1.debugLog)(`[DEBUG] Login API response:`);
                    (0, DebugLogger_1.debugLog)(result);
                }
            }
            const jsonData = JSON.parse(result);
            return jsonData;
        }
        catch (e) {
            if ((0, DebugLogger_1.isDebugEnabled)()) {
                const options = (0, DebugLogger_1.getDebugOptions)();
                if (options.response) {
                    (0, DebugLogger_1.debugLog)(`[DEBUG] Login API error:`);
                    (0, DebugLogger_1.debugLog)(e.message);
                }
            }
            throw e;
        }
    });
}
function inquireAccount(accounts) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const accountName = yield (0, inquirer_1.prompt)([{
                type: "list",
                name: "account",
                choices: [...accounts.map(acc => acc.account), "Other"],
                message: "Which opensubtitles account do you wish to use?"
            }]);
        return (_a = accounts.find(acc => acc.account === accountName.account)) !== null && _a !== void 0 ? _a : null;
    });
}
function inquireCredentials() {
    return __awaiter(this, void 0, void 0, function* () {
        while (true) {
            const credentials = yield (0, inquirer_1.prompt)([
                { type: "input", name: "account", message: "Username:" },
                { type: "password", name: "password", message: "Password:" }
            ]);
            if ((0, Util_1.isString)(credentials.password, credentials.account)) {
                return credentials;
            }
            else {
                console.log(chalk.redBright(`${os_1.EOL}Username/Password cannot be empty!${os_1.EOL}`));
            }
        }
    });
}
//# sourceMappingURL=Authentication.js.map