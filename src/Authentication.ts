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

import * as keytar from "keytar"
import * as chalk from "chalk"
import {prompt} from "inquirer"
import {isString} from "./Util";
import * as OpenSubtitles from "opensubtitles.com"
import * as ora from "ora"
import Preferences from "./Preferences";
import {IOpenSubtitles} from "./Types";
import {EOL} from "os"
import {getApiKey} from "./Config";
import {createDebugWrapper, setDebugWrapperOptions} from "./DebugWrapper";
import {isDebugEnabled, getDebugOptions, debugLog} from "./DebugLogger";

interface Credentials {
    account: string;
    password: string;
}

export async function createAnonymousClient(): Promise<IOpenSubtitles> {
    const osub = new OpenSubtitles({
        apikey: getApiKey(),
        useragent: "opensubs-cli v" + require("../package.json").version
    });

    // Wrap with debug logger if debug mode is enabled
    if (isDebugEnabled()) {
        const options = getDebugOptions();
        setDebugWrapperOptions({ request: options.request, response: options.response });
        return createDebugWrapper(osub as any);
    }

    return osub;
}

export async function createAuthenticatedClient(token: string): Promise<IOpenSubtitles> {
    const osub = new OpenSubtitles({
        apikey: getApiKey(),
        useragent: "opensubs-cli v" + require("../package.json").version
    });

    // Set the token on the client
    (osub as any).token = token;

    // Wrap with debug logger if debug mode is enabled
    if (isDebugEnabled()) {
        const options = getDebugOptions();
        setDebugWrapperOptions({ request: options.request, response: options.response });
        return createDebugWrapper(osub as any);
    }

    return osub;
}

export default async function authenticate(): Promise<IOpenSubtitles> {
    let accounts: Credentials[] = await keytar.findCredentials("opensubtitles.com");

    return getCredentialsRec(accounts);
}

async function getCredentialsRec(accounts: Credentials[], triedAccounts: string[] = [], firstPass: boolean = true): Promise<IOpenSubtitles> {
    let credentials: Credentials = null;

    const validAccounts = accounts.filter(acc => triedAccounts.indexOf(acc.account) < 0);


    if (validAccounts.length > 0) {
        if (firstPass && accounts.findIndex(acc => acc.account === Preferences.account) > -1) {
            credentials = accounts.find(acc => acc.account === Preferences.account);
        } else {
            credentials = await inquireAccount(validAccounts);
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
        credentials = await inquireCredentials();
    }

    // Clean password if it contains the old pipe separator (from previous versions)
    if (credentials.password.includes("|")) {
        const parts = credentials.password.split("|");
        credentials.password = parts[0];
    }

    let osub = await tryCredentials(credentials);
    if (osub !== null) {
        await keytar.setPassword("opensubtitles.com", credentials.account, credentials.password);
        Preferences.account = credentials.account;

        // Save the bearer token for future sessions
        const token = (osub as any).token;
        if (token) {
            Preferences.saveToken(token);
        }

        return osub;
    } else {
        return getCredentialsRec(accounts, triedAccounts, false);
    }
}

async function tryCredentials(credentials: Credentials): Promise<any> {
    const spinner = ora(chalk.yellow(`Logging in ${credentials.account}`)).start();
    try {
        // Direct API call to login endpoint using curl (library incorrectly uses GET instead of POST)
        const loginResponse = await directLoginCall(credentials.account, credentials.password);

        if (!loginResponse.token) {
            const message = loginResponse.message || "No token returned from API";
            throw new Error(message);
        }

        spinner.succeed(`Successfully logged in as ${chalk.blueBright(credentials.account)}`);

        // Create client with the token
        const osub = new OpenSubtitles({
            apikey: getApiKey(),
            useragent: "opensubs-cli v" + require("../package.json").version
        });

        // Set the token on the client
        (osub as any).token = loginResponse.token;

        // Wrap with debug logger if debug mode is enabled
        if (isDebugEnabled()) {
            const options = getDebugOptions();
            setDebugWrapperOptions({ request: options.request, response: options.response });
            return createDebugWrapper(osub as any);
        }

        return osub;
    } catch (e) {
        // console.error(e);
        spinner.fail(`Failed to log in as ${chalk.blueBright(credentials.account)}. Error: ${chalk.redBright(e.message)}`);
        return null;
    }
}

// Direct API call to login endpoint using curl (library incorrectly uses GET instead of POST)
async function directLoginCall(username: string, password: string): Promise<{ token?: string; message?: string; user?: any }> {
    const {execSync} = require('child_process');
    const url = 'https://api.opensubtitles.com/api/v1/login';

    if (isDebugEnabled()) {
        const options = getDebugOptions();
        if (options.request) {
            debugLog(`\n[DEBUG] Direct login API call (using curl)`);
            debugLog(`URL: ${url}`);
            debugLog(`username: ${username}`);
        }
    }

    try {
        const curlCommand = `curl -s --request POST --url '${url}' --header 'Api-Key: ${getApiKey()}' --header 'Content-Type: application/json' --header 'User-Agent: opensubs-cli v${require("../package.json").version}' --data '{"username":"${username}","password":"${password}"}'`;

        const result = execSync(curlCommand, {encoding: 'utf-8'});

        if (isDebugEnabled()) {
            const options = getDebugOptions();
            if (options.response) {
                debugLog(`[DEBUG] Login API response:`);
                debugLog(result);
            }
        }

        const jsonData = JSON.parse(result);
        return jsonData;
    } catch (e) {
        if (isDebugEnabled()) {
            const options = getDebugOptions();
            if (options.response) {
                debugLog(`[DEBUG] Login API error:`);
                debugLog(e.message);
            }
        }
        throw e;
    }
}

async function inquireAccount(accounts: Credentials[]): Promise<Credentials> {
    const accountName = await prompt([{
        type: "list",
        name: "account",
        choices: [...accounts.map(acc => acc.account), "Other"],
        message: "Which opensubtitles account do you wish to use?"
    }]);

    return accounts.find(acc => acc.account === accountName.account) ?? null;
}

async function inquireCredentials(): Promise<Credentials> {
    while (true) {
        const credentials: Credentials = await prompt([
            { type: "input", name: "account", message: "Username:" },
            { type: "password", name: "password", message: "Password:" }
        ]);

        if (isString(credentials.password, credentials.account)) {
            return credentials;
        } else {
            console.log(chalk.redBright(`${EOL}Username/Password cannot be empty!${EOL}`))
        }
    }
}
