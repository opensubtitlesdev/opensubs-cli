#!/usr/bin/env bash
# Download real video fixtures for hash-based subtitle tests.
# Files are gitignored — run this once before running npm run test:e2e:download
#
# Files downloaded:
#   Big Buck Bunny 320x180 (~62 MB) — CC-BY 3.0 — Blender Foundation
#   Pioneer One S01E01 480p (~171 MB) — CC-BY-NC-SA — Pioneer One team / VODO

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/downloads" && pwd)"

download() {
    local url="$1"
    local dest="$2"
    if [ -f "$dest" ]; then
        echo "  already exists, skipping: $(basename "$dest")"
        return
    fi
    echo "  downloading: $(basename "$dest")"
    if command -v curl &>/dev/null; then
        curl -L --progress-bar -o "$dest" "$url"
    elif command -v wget &>/dev/null; then
        wget -q --show-progress -O "$dest" "$url"
    else
        echo "  ERROR: curl or wget required" >&2
        exit 1
    fi
}

echo ""
echo "opensubs-cli test fixtures"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "▸ Big Buck Bunny (2008) — tt1254207 — CC-BY 3.0"
download \
    "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4" \
    "$DIR/BigBuckBunny_320x180.mp4"

echo ""
echo "▸ Pioneer One S01E01 (2010) — tt1748166 — CC-BY-NC-SA"
download \
    "https://archive.org/download/pioneer-one/data/season%201/01.mp4" \
    "$DIR/Pioneer.One.S01E01.480p.mp4"

echo ""
echo "Done. Run: npm run test:e2e:download"
echo ""
