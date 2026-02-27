import {IOpenSubtitles, ISubInfo} from "./Types";
import * as chalk from "chalk";
import {debugLog} from "./DebugLogger";

let debugRequest = false;
let debugResponse = false;

export function setDebugWrapperOptions(options: { request?: boolean; response?: boolean }) {
    debugRequest = options.request ?? false;
    debugResponse = options.response ?? false;
}

function logMethodCall(method: string, params: any) {
    if (!debugRequest) return;
    debugLog(`\n[DEBUG] Calling OpenSubtitles.${method}()`);
    debugLog("Parameters:");
    debugLog(JSON.stringify(params, null, 2));
}

function logMethodResult(method: string, result: any) {
    if (!debugResponse) return;
    debugLog(`[DEBUG] OpenSubtitles.${method}() returned:`);
    debugLog(JSON.stringify(result, null, 2));
}

function logMethodError(method: string, error: any) {
    if (!debugResponse) return;
    debugLog(`[DEBUG] OpenSubtitles.${method}() threw error:`);
    debugLog(error.message || error);
    if (error.response) {
        debugLog("Response data:");
        debugLog(JSON.stringify(error.response.data, null, 2));
    }
}

export function createDebugWrapper(client: IOpenSubtitles): IOpenSubtitles {
    const wrapper: any = {
        async login(auth: { username: string; password: string }): Promise<any> {
            logMethodCall("login", { username: auth.username, password: "***" });
            try {
                const result = await client.login(auth);
                logMethodResult("login", result);
                return result;
            } catch (error) {
                logMethodError("login", error);
                throw error;
            }
        },

        async subtitles(params: {
            languages?: string;
            moviehash?: string;
            query?: string;
            type?: string;
            [key: string]: any
        }): Promise<{ data: ISubInfo[] }> {
            logMethodCall("subtitles", params);
            try {
                const result = await client.subtitles(params);
                logMethodResult("subtitles", {
                    data_count: result.data?.length || 0,
                    data: result.data?.slice(0, 2) || [] // Log only first 2 results to avoid clutter
                });
                return result;
            } catch (error) {
                logMethodError("subtitles", error);
                throw error;
            }
        },

        async download(params: { file_id: number; [key: string]: any }): Promise<{ link: string }> {
            logMethodCall("download", params);
            try {
                const result = await client.download(params);
                logMethodResult("download", result);
                return result;
            } catch (error) {
                logMethodError("download", error);
                throw error;
            }
        }
    };

    // Preserve token and other properties from the original client
    if ((client as any).token) {
        wrapper.token = (client as any).token;
    }

    return wrapper;
}
