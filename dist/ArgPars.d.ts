import * as commander from "commander";
interface Arguments {
    lang: string;
    username?: string;
    password?: string;
    overwrite?: boolean;
    saveLang?: boolean;
    path: string;
    parser: commander.Command;
    info: boolean;
    notificationOutput: boolean;
    noPrompt: boolean;
    debug: boolean;
    debugRequest: boolean;
    debugResponse: boolean;
    debugHeaders: boolean;
    config: boolean;
    setLanguages: boolean;
    allLanguages: boolean;
    allFiles: boolean;
}
export default function parse(): Arguments;
export {};
