import { IOpenSubtitles } from "./Types";
export declare function setDebugWrapperOptions(options: {
    request?: boolean;
    response?: boolean;
}): void;
export declare function createDebugWrapper(client: IOpenSubtitles): IOpenSubtitles;
