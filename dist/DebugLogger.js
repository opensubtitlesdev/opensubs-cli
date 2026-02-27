"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enableDebug = enableDebug;
exports.isDebugEnabled = isDebugEnabled;
exports.getDebugOptions = getDebugOptions;
exports.debugLog = debugLog;
exports.logSection = logSection;
exports.logRequest = logRequest;
exports.logResponse = logResponse;
exports.logError = logError;
exports.interceptHTTPS = interceptHTTPS;
const chalk = require("chalk");
const https = require("https");
const fs_1 = require("fs");
const LOG_FILE = '/tmp/opensubs-cli.log';
let debugRequest = false;
let debugResponse = false;
let debugHeaders = false;
function writeLog(message) {
    try {
        (0, fs_1.appendFileSync)(LOG_FILE, message + '\n', { encoding: 'utf8' });
    }
    catch (e) {
        // Ignore write errors
    }
}
function enableDebug(options) {
    var _a, _b, _c;
    debugRequest = (_a = options.request) !== null && _a !== void 0 ? _a : false;
    debugResponse = (_b = options.response) !== null && _b !== void 0 ? _b : false;
    debugHeaders = (_c = options.headers) !== null && _c !== void 0 ? _c : false;
    // Clear log file at start
    try {
        (0, fs_1.writeFileSync)(LOG_FILE, `===== OpenSubs CLI Debug Log - ${new Date().toISOString()} =====\n`, { encoding: 'utf8' });
        console.log(chalk.magenta(`Debug output will be written to: ${LOG_FILE}`));
    }
    catch (e) {
        // Ignore
    }
}
function isDebugEnabled() {
    return debugRequest || debugResponse || debugHeaders;
}
function getDebugOptions() {
    return {
        request: debugRequest,
        response: debugResponse,
        headers: debugHeaders
    };
}
function debugLog(message) {
    if (!isDebugEnabled())
        return;
    writeLog(message);
}
function logSection(title) {
    if (!isDebugEnabled())
        return;
    writeLog("\n" + "=".repeat(80));
    writeLog(`  ${title}`);
    writeLog("=".repeat(80));
}
function logRequest(url, method, headers, body) {
    if (!debugRequest && !debugHeaders)
        return;
    logSection("API REQUEST");
    writeLog(`Method: ${method}`);
    writeLog(`URL: ${url}`);
    if (debugHeaders) {
        writeLog("Headers:");
        writeLog(JSON.stringify(headers, null, 2));
    }
    if (debugRequest && body) {
        writeLog("Body:");
        writeLog(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    }
}
function logResponse(statusCode, statusMessage, headers, body) {
    if (!debugResponse && !debugHeaders)
        return;
    logSection("API RESPONSE");
    writeLog(`Status: ${statusCode} ${statusMessage}`);
    if (debugHeaders) {
        writeLog("Headers:");
        writeLog(JSON.stringify(headers, null, 2));
    }
    if (debugResponse && body) {
        // Check if body looks like binary data
        const isBinary = typeof body === 'string' && (body.includes('\x00') || // NULL byte
            body.length > 50000 // Very large (probably binary file)
        );
        if (isBinary) {
            writeLog("Body: [Binary data not logged]");
        }
        else {
            writeLog("Body:");
            try {
                const parsed = typeof body === 'string' ? JSON.parse(body) : body;
                writeLog(JSON.stringify(parsed, null, 2));
            }
            catch (e) {
                // Not JSON, log as is if it's reasonably sized
                if (typeof body === 'string' && body.length < 10000) {
                    writeLog(body);
                }
                else {
                    writeLog(`[Non-JSON data, ${typeof body === 'string' ? body.length : '?'} bytes]`);
                }
            }
        }
    }
    writeLog("=".repeat(80) + "\n");
}
function logError(error) {
    if (!isDebugEnabled())
        return;
    logSection("API ERROR");
    writeLog(`Error: ${error.message || error}`);
    if (error.stack) {
        writeLog(error.stack);
    }
    writeLog("=".repeat(80) + "\n");
}
// Intercept HTTPS requests for debugging
function interceptHTTPS() {
    if (!isDebugEnabled())
        return;
    const originalRequest = https.request;
    // @ts-ignore
    https.request = function (...args) {
        let url;
        let options;
        let callback;
        // Parse arguments - got library uses (url, options, callback) format
        if (typeof args[0] === 'string') {
            url = args[0];
            options = args[1] || {};
            callback = args[2];
        }
        else {
            options = args[0] || {};
            callback = args[1];
            url = options.href || `https://${options.hostname}${options.path || ''}`;
        }
        // @ts-ignore
        const req = originalRequest.apply(this, args);
        if (url.includes('opensubtitles.com')) {
            const method = options.method || 'GET';
            // Capture headers after request is created (got library sets them later)
            setTimeout(() => {
                const headers = req.getHeaders ? req.getHeaders() : (options.headers || {});
                logRequest(url, method, headers);
            }, 0);
            const originalOn = req.on.bind(req);
            req.on = function (event, listener) {
                if (event === 'response') {
                    const wrappedListener = function (res) {
                        const contentType = res.headers['content-type'] || '';
                        const isText = contentType.includes('json') || contentType.includes('text') || contentType.includes('xml');
                        // Only log text responses (not binary subtitle files)
                        if (isText) {
                            let data = '';
                            res.on('data', (chunk) => {
                                data += chunk;
                            });
                            res.on('end', () => {
                                logResponse(res.statusCode, res.statusMessage, res.headers, data);
                            });
                        }
                        else {
                            // Just log status for binary responses
                            logResponse(res.statusCode, res.statusMessage, res.headers, '[Binary data not logged]');
                        }
                        listener(res);
                    };
                    return originalOn(event, wrappedListener);
                }
                return originalOn(event, listener);
            };
        }
        return req;
    };
}
//# sourceMappingURL=DebugLogger.js.map