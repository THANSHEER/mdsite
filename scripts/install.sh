#!/bin/sh
# mdsite installer — downloads the standalone binary (no Node required).
#
#   curl -fsSL https://raw.githubusercontent.com/THANSHEER/mdsite/main/scripts/install.sh | sh
#
# Env overrides:
#   MDSITE_VERSION   tag to install (default: latest)
#   MDSITE_BIN_DIR   install dir (default: /usr/local/bin, fallback ~/.local/bin)
set -eu

REPO="THANSHEER/mdsite"
VERSION="${MDSITE_VERSION:-latest}"

# --- detect platform -------------------------------------------------------
os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Darwin) os="darwin" ;;
  Linux)  os="linux" ;;
  *) echo "mdsite: unsupported OS '$os' — use npm: npm i -g mdsite" >&2; exit 1 ;;
esac
case "$arch" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64)  arch="x64" ;;
  *) echo "mdsite: unsupported arch '$arch' — use npm: npm i -g mdsite" >&2; exit 1 ;;
esac

asset="mdsite-${os}-${arch}.tar.gz"
if [ "$VERSION" = "latest" ]; then
  url="https://github.com/${REPO}/releases/latest/download/${asset}"
else
  url="https://github.com/${REPO}/releases/download/${VERSION}/${asset}"
fi

# --- pick a writable install dir ------------------------------------------
bindir="${MDSITE_BIN_DIR:-/usr/local/bin}"
if [ ! -d "$bindir" ] || [ ! -w "$bindir" ]; then
  if [ "$bindir" = "/usr/local/bin" ]; then
    bindir="$HOME/.local/bin"
    mkdir -p "$bindir"
  else
    echo "mdsite: install dir '$bindir' is not writable" >&2; exit 1
  fi
fi

# --- download + extract ----------------------------------------------------
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "mdsite: downloading ${asset} (${VERSION})..."
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$url" -o "$tmp/m.tar.gz"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$tmp/m.tar.gz" "$url"
else
  echo "mdsite: need curl or wget" >&2; exit 1
fi

tar -xzf "$tmp/m.tar.gz" -C "$tmp"
install -m 0755 "$tmp/mdsite" "$bindir/mdsite" 2>/dev/null || {
  mv "$tmp/mdsite" "$bindir/mdsite"; chmod 0755 "$bindir/mdsite";
}

echo "mdsite: installed to $bindir/mdsite"
case ":$PATH:" in
  *":$bindir:"*) ;;
  *) echo "mdsite: add $bindir to your PATH:  export PATH=\"$bindir:\$PATH\"" ;;
esac
"$bindir/mdsite" --version || true
