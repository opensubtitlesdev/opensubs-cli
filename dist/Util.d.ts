import { ILanguage, IApiLanguage, IUserInfo } from "./Types";
import { IncomingHttpHeaders } from "http";
export declare function isString(...str: string[]): boolean;
export declare function getLang(lang: string): ILanguage;
export declare function fetchApiLanguages(): Promise<IApiLanguage[]>;
export declare function fetchUserInfo(token?: string | null): Promise<IUserInfo>;
export declare function downloadFile(url: string, path: string, unzip?: boolean): Promise<IncomingHttpHeaders>;
