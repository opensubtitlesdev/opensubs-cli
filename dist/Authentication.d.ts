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
import { IOpenSubtitles } from "./Types";
export declare function createAnonymousClient(): Promise<IOpenSubtitles>;
export declare function createAuthenticatedClient(token: string): Promise<IOpenSubtitles>;
export default function authenticate(): Promise<IOpenSubtitles>;
