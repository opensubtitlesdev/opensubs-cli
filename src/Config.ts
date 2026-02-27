// Global configuration for OpenSubs CLI

// OpenSubtitles.com API Key - shared for all users of opensubs-cli
// This allows usage tracking and eliminates the need for users to create their own API keys
const API_KEY = "m4INUVkhtR9pUdfKKdWy3Js9XQrVlOei";

export function getApiKey(): string {
    return API_KEY;
}
