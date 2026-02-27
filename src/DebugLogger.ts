import * as chalk from "chalk";
import * as https from "https";
import * as http from "http";
import {appendFileSync, writeFileSync} from "fs";

const LOG_FILE = '/tmp/opensubs-cli.log';

let debugRequest = false;
let debugResponse = false;
let debugHeaders = false;

function writeLog(message: string) {
    try {
        appendFileSync(LOG_FILE, message + '\n', {encoding: 'utf8'});
    } catch (e) {
        // Ignore write errors
    }
}

export function enableDebug(options: { request?: boolean; response?: boolean; headers?: boolean }) {
    debugRequest = options.request ?? false;
    debugResponse = options.response ?? false;
    debugHeaders = options.headers ?? false;

    // Clear log file at start
    try {
        writeFileSync(LOG_FILE, `===== OpenSubs CLI Debug Log - ${new Date().toISOString()} =====\n`, {encoding: 'utf8'});
        console.log(chalk.magenta(`Debug output will be written to: ${LOG_FILE}`));
    } catch (e) {
        // Ignore
    }
}

export function isDebugEnabled(): boolean {
    return debugRequest || debugResponse || debugHeaders;
}

export function getDebugOptions(): { request: boolean; response: boolean; headers: boolean } {
    return {
        request: debugRequest,
        response: debugResponse,
        headers: debugHeaders
    };
}

export function debugLog(message: string) {
    if (!isDebugEnabled()) return;
    writeLog(message);
}

export function logSection(title: string) {
    if (!isDebugEnabled()) return;
    writeLog("\n" + "=".repeat(80));
    writeLog(`  ${title}`);
    writeLog("=".repeat(80));
}

export function logRequest(url: string, method: string, headers: any, body?: any) {
    if (!debugRequest && !debugHeaders) return;

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

export function logResponse(statusCode: number, statusMessage: string, headers: any, body?: any) {
    if (!debugResponse && !debugHeaders) return;

    logSection("API RESPONSE");
    writeLog(`Status: ${statusCode} ${statusMessage}`);

    if (debugHeaders) {
        writeLog("Headers:");
        writeLog(JSON.stringify(headers, null, 2));
    }

    if (debugResponse && body) {
        // Check if body looks like binary data
        const isBinary = typeof body === 'string' && (
            body.includes('\x00') ||  // NULL byte
            body.length > 50000  // Very large (probably binary file)
        );

        if (isBinary) {
            writeLog("Body: [Binary data not logged]");
        } else {
            writeLog("Body:");
            try {
                const parsed = typeof body === 'string' ? JSON.parse(body) : body;
                writeLog(JSON.stringify(parsed, null, 2));
            } catch (e) {
                // Not JSON, log as is if it's reasonably sized
                if (typeof body === 'string' && body.length < 10000) {
                    writeLog(body);
                } else {
                    writeLog(`[Non-JSON data, ${typeof body === 'string' ? body.length : '?'} bytes]`);
                }
            }
        }
    }
    writeLog("=".repeat(80) + "\n");
}

export function logError(error: any) {
    if (!isDebugEnabled()) return;

    logSection("API ERROR");
    writeLog(`Error: ${error.message || error}`);
    if (error.stack) {
        writeLog(error.stack);
    }
    writeLog("=".repeat(80) + "\n");
}

// Intercept HTTPS requests for debugging
export function interceptHTTPS() {
    if (!isDebugEnabled()) return;

    const originalRequest = https.request;

    // @ts-ignore
    https.request = function(...args: any[]) {
        let url: string;
        let options: any;
        let callback: any;

        // Parse arguments - got library uses (url, options, callback) format
        if (typeof args[0] === 'string') {
            url = args[0];
            options = args[1] || {};
            callback = args[2];
        } else {
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
                const headers = (req as any).getHeaders ? (req as any).getHeaders() : (options.headers || {});
                logRequest(url, method, headers);
            }, 0);

            const originalOn = req.on.bind(req);
            req.on = function(event: string, listener: any) {
                if (event === 'response') {
                    const wrappedListener = function(res: http.IncomingMessage) {
                        const contentType = res.headers['content-type'] || '';
                        const isText = contentType.includes('json') || contentType.includes('text') || contentType.includes('xml');

                        // Only log text responses (not binary subtitle files)
                        if (isText) {
                            let data = '';

                            res.on('data', (chunk) => {
                                data += chunk;
                            });

                            res.on('end', () => {
                                logResponse(res.statusCode!, res.statusMessage!, res.headers, data);
                            });
                        } else {
                            // Just log status for binary responses
                            logResponse(res.statusCode!, res.statusMessage!, res.headers, '[Binary data not logged]');
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
