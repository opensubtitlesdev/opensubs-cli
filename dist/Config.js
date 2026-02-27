"use strict";
// Global configuration for OpenSubs CLI
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiKey = getApiKey;
// OpenSubtitles.com API Key - shared for all users of opensubs-cli
// This allows usage tracking and eliminates the need for users to create their own API keys
const API_KEY = "m4INUVkhtR9pUdfKKdWy3Js9XQrVlOei";
function getApiKey() {
    return API_KEY;
}
//# sourceMappingURL=Config.js.map