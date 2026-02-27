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
exports.PREF_FILE = exports.PREF_DIR = void 0;
const platform_folders_1 = require("platform-folders");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
exports.PREF_DIR = (0, path_1.join)((0, platform_folders_1.getDataHome)(), "Subtitles CLI");
exports.PREF_FILE = (0, path_1.join)(exports.PREF_DIR, "preferences.json");
const TOKEN_FILE = (0, path_1.join)(exports.PREF_DIR, "token.txt");
class Preferences {
    loadPreferences() {
        return __awaiter(this, void 0, void 0, function* () {
            yield (0, fs_extra_1.ensureFile)(exports.PREF_FILE);
            try {
                const pref = yield (0, fs_extra_1.readJson)(exports.PREF_FILE);
                this._lang = pref.lang;
                this._account = pref.account;
                this._useragent = pref.useragent;
                this._anonymousDownloadCount = pref.anonymousDownloadCount || 0;
            }
            catch (e) {
                this._anonymousDownloadCount = 0;
                this.writeFile();
            }
        });
    }
    writeFile() {
        (0, fs_extra_1.writeJsonSync)(exports.PREF_FILE, {
            lang: this._lang,
            account: this._account,
            useragent: this._useragent,
            anonymousDownloadCount: this._anonymousDownloadCount
        });
    }
    get lang() {
        return this._lang;
    }
    get account() {
        return this._account;
    }
    get useragent() {
        return this._account;
    }
    set lang(value) {
        this._lang = value;
        this.writeFile();
    }
    set account(value) {
        this._account = value;
        this.writeFile();
    }
    set useragent(value) {
        this._useragent = value;
        this.writeFile();
    }
    get anonymousDownloadCount() {
        return this._anonymousDownloadCount || 0;
    }
    set anonymousDownloadCount(value) {
        this._anonymousDownloadCount = value;
        this.writeFile();
    }
    incrementAnonymousDownloadCount() {
        this._anonymousDownloadCount = (this._anonymousDownloadCount || 0) + 1;
        this.writeFile();
    }
    resetAnonymousDownloadCount() {
        this._anonymousDownloadCount = 0;
        this.writeFile();
    }
    // Token management
    saveToken(token) {
        (0, fs_extra_1.writeFileSync)(TOKEN_FILE, token, { encoding: 'utf8' });
    }
    getToken() {
        if (!(0, fs_extra_1.pathExistsSync)(TOKEN_FILE)) {
            return null;
        }
        try {
            return (0, fs_extra_1.readFileSync)(TOKEN_FILE, { encoding: 'utf8' });
        }
        catch (e) {
            return null;
        }
    }
    clearToken() {
        if ((0, fs_extra_1.pathExistsSync)(TOKEN_FILE)) {
            const fs = require('fs');
            fs.unlinkSync(TOKEN_FILE);
        }
    }
    isTokenExpired(token) {
        try {
            // JWT has 3 parts separated by dots: header.payload.signature
            const parts = token.split('.');
            if (parts.length !== 3) {
                return true;
            }
            // Decode the payload (second part)
            const payload = Buffer.from(parts[1], 'base64').toString('utf8');
            const data = JSON.parse(payload);
            // Check expiry (exp is in seconds since epoch)
            if (data.exp) {
                const expiryTime = data.exp * 1000; // Convert to milliseconds
                const now = Date.now();
                return now >= expiryTime;
            }
            // If no expiry, consider it expired
            return true;
        }
        catch (e) {
            // If we can't parse it, consider it expired
            return true;
        }
    }
}
exports.default = new Preferences();
//# sourceMappingURL=Preferences.js.map