# OpenSubs CLI

A full featured, easy to use, CLI app to download subtitles from OpenSubtitles.com.

![](subs-terminal.gif)

## Credits

This project is based on [subs-cli](https://github.com/alexandrucancescu/subs-cli) by [Alexandru Cancescu](https://github.com/alexandrucancescu). The original project has been updated to work with the new OpenSubtitles.com API and republished under a new package name to continue its development.

## Features

- Download subtitles for a single file or an entire directory (recursively)
- Download the best subtitle per language, saved as `movie.fr.srt`, `movie.en.srt`
- Download all available subtitle results into a subfolder `movie/subname.fr.srt`
- Multi-language support — download subtitles for several languages in one run
- First **5 downloads are free** without an account; login to get up to 999,999/day
- Credentials stored securely in your OS keychain (Keychain / Credential Vault / Secret Service)
- Interactive language picker fetched live from the OpenSubtitles API
- Skips files that already have subtitles (use `--overwrite` to re-download)
- No API key setup required — just install and use

## Install

```sh
npm install -g opensubs-cli
```

If you encounter an `EACCES` error on macOS, see [Installation Problems](#installation-problems).

## Requirements

You can start immediately — the first **5 subtitle downloads are free** without an account.

After 5 downloads, create a free account at [opensubtitles.com](https://www.opensubtitles.com). You only need your username and password; the API key is embedded in the tool.

---

## Usage

### Basic

```sh
# Download subtitles for a single file
opensubs /path/to/movie.mkv

# Download subtitles for all video files in a directory (recursive)
opensubs /path/to/dir
```

The subtitle is saved alongside the video file: `movie.fr.srt` (language code always included).

---

### Options reference

```
Usage: opensubs <path> [options]

Info:
  -V, --version              output the version number
  -c, --config               show current configuration and exit
  -I, --info                 show your OpenSubtitles account info from the API
  --set-languages            interactively set default language(s) from the API list
  -h, --help                 display help for command

Download:
  -l, --lang <value>         language code(s), e.g. en or en,fr,de  (default: en)
  -L, --all-languages        best subtitle per language  → movie.fr.srt, movie.en.srt
  -F, --all-files            all results into a subfolder  → movie/subname.fr.srt
  -o, --overwrite            overwrite existing subtitles
  -s, --save-lang            save language as default

Options:
  -N, --no-prompt            never prompt for user input

Debug:
  -d, --debug                enable all debug output (requests, responses, headers)
  --debug-request            show debug output for API requests
  --debug-response           show debug output for API responses
  --debug-headers            show debug output for HTTP headers
```

---

### Language

Languages are identified by their [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) code (e.g. `en`, `fr`, `de`). Some languages use extended codes such as `pt-pt`, `pt-br`, `zh-cn`, `zh-tw`.

```sh
# Download French subtitles
opensubs /path/to/movie.mkv -l fr

# Download and save French as the default language
opensubs /path/to/movie.mkv -l fr -s
```

Use `--set-languages` to pick from the full list fetched live from the API:

```sh
opensubs --set-languages
```

This displays all supported language codes and lets you type one or more codes (e.g. `en,fr,de`) to save as your default.

---

### Multi-language (`-L`)

Download the best matching subtitle for each language in your list, saved as `movie.<lang>.srt` alongside the video file.

```sh
# Download best English and French subtitles
opensubs /path/to/dir -L -l en,fr
```

Output:
```
movie.en.srt
movie.fr.srt
```

---

### All results (`-F`)

Download **every** subtitle result (not just the best match) for a video into a subfolder named after the video file. The language code is appended to each subtitle filename.

```sh
# All French results for a file
opensubs /path/to/movie.mkv -F -l fr
```

Output:
```
movie/
  Movie.2024.DVDRIP.fr.srt
  Movie.2024.WEB-DL.fr.srt
  ...
```

Combine `-F` and `-L` to get all results for every language in the same folder:

```sh
opensubs /path/to/dir -F -L -l en,fr
```

Output:
```
movie/
  Movie.2024.DVDRIP.en.srt
  Movie.2024.DVDRIP.fr.srt
  Movie.2024.WEB-DL.en.srt
  ...
```

---

### Configuration (`-c`)

Show the current configuration — config file path, saved account, language, anonymous quota, and token status:

```sh
opensubs -c
```

---

### Account info (`-I`)

Query the OpenSubtitles API for your account details (level, daily download quota, remaining downloads, VIP status):

```sh
opensubs -I
```

Example output:
```
  OpenSubs — Account Info
────────────────────────────────────────────
  Username           : yourname
  Level              : Sub leecher
  User ID            : 12345
  Allowed downloads  : 20
  Remaining today    : 18
  Downloads used     : 2
  VIP                : No
  Authenticated      : Yes
────────────────────────────────────────────
```

---

### Overwrite (`-o`)

By default, files that already have a subtitle alongside them are skipped. Use `--overwrite` to force re-download:

```sh
opensubs /path/to/dir -o
```

---

### No prompt (`-N`)

Skip all interactive confirmation prompts (useful for scripting / automation):

```sh
opensubs /path/to/dir -N
```

---

## Installation problems

### macOS

npm installs global packages into `/usr/local/lib/node_modules`. You may need to run with `sudo`:

```sh
sudo npm install -g opensubs-cli
```

That can cause a secondary problem: npm drops sudo privileges for scripts and sets the user to `nobody`, preventing **keytar** (the secure credential store) from installing its native modules.

The cleanest workaround is to change ownership of the global node_modules directory and install without sudo:

```sh
sudo chown -R $(whoami):admin /usr/local/lib/node_modules
npm install -g opensubs-cli
```

Alternatively:

```sh
sudo npm install -g --unsafe-perm opensubs-cli
```

More info [here](https://stackoverflow.com/questions/47252451/permission-denied-when-installing-npm-modules-in-osx).

---

## License

The code in this project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
