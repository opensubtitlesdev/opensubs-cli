import * as commander from "commander"
import {readJsonSync} from "fs-extra"
import {join} from "path"
import {platform} from "os"
import * as chalk from "chalk"

interface Arguments{
	lang:string;
	username?:string;
	password?:string;
	overwrite?:boolean;
	saveLang?:boolean;
	path:string;
	parser:commander.Command;
	info:boolean;
	notificationOutput:boolean;
	noPrompt:boolean;
	debug:boolean;
	debugRequest:boolean;
	debugResponse:boolean;
	debugHeaders:boolean;
	config:boolean;
	setLanguages:boolean;
	allLanguages:boolean;
	allFiles:boolean;
	lookupFeature:boolean;
	featureType?:string;
	query?:string;
	select?:number;
}

export default function parse():Arguments{
	const pack=readJsonSync(join(__dirname,"../package.json"));
	const program=new commander.Command("opensubs");
	program.version(pack.version);

	program.option("-W, --lookup-feature","search OpenSubtitles for a title and write a .opensubs sidecar file");
	program.option("--type <value>","feature type override for -W: movie or episode");
	program.option("--query <value>","custom search query for -W (overrides filename/guessit)");
	program.option("--select <n>","auto-select result #n for -W (non-interactive, useful for scripting/testing)");
	program.option("-c, --config","show current configuration and exit");
	program.option("-I, --info","query the OpenSubtitles API for your account information");
	program.option("--set-languages","interactively fetch and set default language(s) from the OpenSubtitles language list");
	program.option("-l, --lang <value>","language code(s) for subtitles, e.g. en or en,fr,de (default: en)");
	program.option("-L, --all-languages","download the best subtitle for each language in your list, saved as file.lang.srt");
	program.option("-F, --all-files","download ALL subtitle results (not just the best) into a subfolder named after the video file");
	program.option("-o, --overwrite","overwrite existing subtitles",false);
	program.option("-s, --save-lang","save the current language as default");
	program.option("-N, --no-prompt","the app will not prompt for any user input");
	program.option("-d, --debug","enable all debug output (requests, responses, headers)");
	program.option("--debug-request","show debug output for API method calls and parameters");
	program.option("--debug-response","show debug output for API responses");
	program.option("--debug-headers","show debug output for HTTP headers only");

	if(platform()==="darwin"){
		program.option("-n, --notification-output","show output as a notification");
	}

	program.usage("<path> [options]")

	// Override Commander's default help with a grouped, colored layout.
	// Column width: widest flag is "-n, --notification-output" (25 chars), pad to 28.
	const col = (flag: string, desc: string) =>
		`  ${chalk.cyan(flag.padEnd(28))}${desc}`;

	const isDarwin = platform() === "darwin";

	(program as any).helpInformation = function(): string {
		return [
			"",
			`  Usage: ${chalk.bold("opensubs")} <path> [options]`,
			"",
			chalk.bold("  Info:"),
			col("-V, --version",   "output the version number"),
			col("-c, --config",    "show current configuration and exit"),
			col("-I, --info",      "show your OpenSubtitles account info from the API"),
			col("--set-languages", "interactively set default language(s) from the API list"),
			col("-h, --help",      "display help for command"),
			"",
			chalk.bold("  Sidecar:"),
			col("-W, --lookup-feature",    "search for a title and write a .opensubs sidecar"),
			col("--type <movie|episode>",  "force type for -W (default: auto-detect)"),
			col("--query <value>",         "custom search query for -W"),
		col("--select <n>",            "auto-select result #n for -W (non-interactive)"),
			"",
			chalk.bold("  Download:"),
			col("-l, --lang <value>",   `language code(s), e.g. ${chalk.yellow("en")} or ${chalk.yellow("en,fr,de")}  (default: en)`),
			col("-L, --all-languages",  `best subtitle per language  → ${chalk.dim("movie.fr.srt, movie.en.srt")}`),
			col("-F, --all-files",      `all results into a subfolder  → ${chalk.dim("movie/subname.fr.srt")}`),
			col("-o, --overwrite",      "overwrite existing subtitles"),
			col("-s, --save-lang",      "save language as default"),
			"",
			chalk.bold("  Options:"),
			col("-N, --no-prompt",           "never prompt for user input"),
			isDarwin ? col("-n, --notification-output", "show output as a macOS notification") : null,
			"",
			chalk.bold("  Debug:"),
			col("-d, --debug",        "enable all debug output (requests, responses, headers)"),
			col("--debug-request",    "show debug output for API requests"),
			col("--debug-response",   "show debug output for API responses"),
			col("--debug-headers",    "show debug output for HTTP headers"),
			"",
		].filter(l => l !== null).join("\n") + "\n";
	};

	program.parse(process.argv);

	return {
		lang:program.lang,
		username:program.username,
		password:program.password,
		overwrite:program.overwrite ?? false,
		saveLang:program.saveLang ?? false,
		path:program.args[0],
		parser:program,
		info: program.info ?? false,
		notificationOutput: program.notificationOutput ?? false,
		noPrompt: program.prompt === false,   // --no-prompt sets program.prompt=false
		debug: program.debug ?? false,
		debugRequest: program.debugRequest ?? false,
		debugResponse: program.debugResponse ?? false,
		debugHeaders: program.debugHeaders ?? false,
		config: program.config ?? false,
		setLanguages: program.setLanguages ?? false,
		allLanguages: program.allLanguages ?? false,
		allFiles: program.allFiles ?? false,
		lookupFeature: program.lookupFeature ?? false,
		featureType: program.type,
		query: program.query,
		select: program.select !== undefined ? parseInt(program.select, 10) : undefined,
	}
}
