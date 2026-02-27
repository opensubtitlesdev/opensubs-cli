export declare const PREF_DIR: string;
export declare const PREF_FILE: string;
declare class Preferences {
    private _lang;
    private _account;
    private _useragent;
    private _anonymousDownloadCount;
    loadPreferences(): Promise<void>;
    writeFile(): void;
    get lang(): string;
    get account(): string;
    get useragent(): string;
    set lang(value: string);
    set account(value: string);
    set useragent(value: string);
    get anonymousDownloadCount(): number;
    set anonymousDownloadCount(value: number);
    incrementAnonymousDownloadCount(): void;
    resetAnonymousDownloadCount(): void;
    saveToken(token: string): void;
    getToken(): string | null;
    clearToken(): void;
    isTokenExpired(token: string): boolean;
}
declare const _default: Preferences;
export default _default;
