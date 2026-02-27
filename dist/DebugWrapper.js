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
exports.setDebugWrapperOptions = setDebugWrapperOptions;
exports.createDebugWrapper = createDebugWrapper;
const DebugLogger_1 = require("./DebugLogger");
let debugRequest = false;
let debugResponse = false;
function setDebugWrapperOptions(options) {
    var _a, _b;
    debugRequest = (_a = options.request) !== null && _a !== void 0 ? _a : false;
    debugResponse = (_b = options.response) !== null && _b !== void 0 ? _b : false;
}
function logMethodCall(method, params) {
    if (!debugRequest)
        return;
    (0, DebugLogger_1.debugLog)(`\n[DEBUG] Calling OpenSubtitles.${method}()`);
    (0, DebugLogger_1.debugLog)("Parameters:");
    (0, DebugLogger_1.debugLog)(JSON.stringify(params, null, 2));
}
function logMethodResult(method, result) {
    if (!debugResponse)
        return;
    (0, DebugLogger_1.debugLog)(`[DEBUG] OpenSubtitles.${method}() returned:`);
    (0, DebugLogger_1.debugLog)(JSON.stringify(result, null, 2));
}
function logMethodError(method, error) {
    if (!debugResponse)
        return;
    (0, DebugLogger_1.debugLog)(`[DEBUG] OpenSubtitles.${method}() threw error:`);
    (0, DebugLogger_1.debugLog)(error.message || error);
    if (error.response) {
        (0, DebugLogger_1.debugLog)("Response data:");
        (0, DebugLogger_1.debugLog)(JSON.stringify(error.response.data, null, 2));
    }
}
function createDebugWrapper(client) {
    const wrapper = {
        login(auth) {
            return __awaiter(this, void 0, void 0, function* () {
                logMethodCall("login", { username: auth.username, password: "***" });
                try {
                    const result = yield client.login(auth);
                    logMethodResult("login", result);
                    return result;
                }
                catch (error) {
                    logMethodError("login", error);
                    throw error;
                }
            });
        },
        subtitles(params) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                logMethodCall("subtitles", params);
                try {
                    const result = yield client.subtitles(params);
                    logMethodResult("subtitles", {
                        data_count: ((_a = result.data) === null || _a === void 0 ? void 0 : _a.length) || 0,
                        data: ((_b = result.data) === null || _b === void 0 ? void 0 : _b.slice(0, 2)) || [] // Log only first 2 results to avoid clutter
                    });
                    return result;
                }
                catch (error) {
                    logMethodError("subtitles", error);
                    throw error;
                }
            });
        },
        download(params) {
            return __awaiter(this, void 0, void 0, function* () {
                logMethodCall("download", params);
                try {
                    const result = yield client.download(params);
                    logMethodResult("download", result);
                    return result;
                }
                catch (error) {
                    logMethodError("download", error);
                    throw error;
                }
            });
        }
    };
    // Preserve token and other properties from the original client
    if (client.token) {
        wrapper.token = client.token;
    }
    return wrapper;
}
//# sourceMappingURL=DebugWrapper.js.map