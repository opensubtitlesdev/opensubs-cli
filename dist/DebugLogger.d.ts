export declare function enableDebug(options: {
    request?: boolean;
    response?: boolean;
    headers?: boolean;
}): void;
export declare function isDebugEnabled(): boolean;
export declare function getDebugOptions(): {
    request: boolean;
    response: boolean;
    headers: boolean;
};
export declare function debugLog(message: string): void;
export declare function logSection(title: string): void;
export declare function logRequest(url: string, method: string, headers: any, body?: any): void;
export declare function logResponse(statusCode: number, statusMessage: string, headers: any, body?: any): void;
export declare function logError(error: any): void;
export declare function interceptHTTPS(): void;
