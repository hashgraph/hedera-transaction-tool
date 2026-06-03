#!/usr/bin/env bash
# Notarize and staple the macOS installer artifacts (.dmg and .pkg) produced by
# `pnpm build:mac` into front-end/release.
#
# This is a deliberate, separate step: `pnpm build:mac` only builds + signs, it
# never notarizes. Run this when cutting a release (locally or in CI).
#
# Order of the full pipeline is: build -> sign (build:mac) -> notarize -> staple
# (this script). Notarization is a post-signing operation and never needs to
# happen during the build.
#
# Credentials are an App Store Connect API key (no keychain involved), so the
# same command works locally and in CI:
#   APPLE_API_KEY     path to the AuthKey_XXXX.p8 file
#   APPLE_API_KEY_ID  the key ID
#   APPLE_API_ISSUER  the issuer UUID
# Locally, put these in a gitignored scripts/release.env (see release.env.example)
# and this script loads them automatically. In CI they come from the workflow
# env, so no file is needed.
#
# By default only the artifacts for the current package.json version are
# processed (release/ accumulates old builds locally), unless -v overrides it.
#
# Neither notarization nor stapling needs sudo: we notarize/staple the .dmg and
# .pkg in our own release/ output dir (we own those files). The "stapler needs
# root / Error 65" advice you may have seen applies to stapling a .app already
# installed under /Applications, which is not what happens here.

set -euo pipefail

usage() {
  echo "Usage: $0 [-v <version>]"
  echo ""
  echo "Options:"
  echo "  -v, --version   Version to process (default: version from front-end/package.json)"
  echo "  -h, --help      Show this help message"
  exit 1
}

VERSION_OVERRIDE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--version) VERSION_OVERRIDE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "❌ Unknown option: $1"; usage ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RELEASE_DIR="${FRONTEND_DIR}/release"

# Load local credentials from scripts/release.env if present (gitignored). In CI
# the vars are already in the environment and the file won't exist, so this is a
# no-op there.
# shellcheck source=./load-release-env.sh
source "${SCRIPT_DIR}/load-release-env.sh"

if [[ -z "${APPLE_API_KEY:-}" || -z "${APPLE_API_KEY_ID:-}" || -z "${APPLE_API_ISSUER:-}" ]]; then
  echo "❌ Missing App Store Connect API key credentials." >&2
  echo "   Set APPLE_API_KEY (path to .p8), APPLE_API_KEY_ID and APPLE_API_ISSUER" >&2
  echo "   (e.g. in ${SCRIPT_DIR}/release.env)." >&2
  exit 1
fi

if [[ ! -f "${APPLE_API_KEY}" ]]; then
  echo "❌ APPLE_API_KEY does not point to a file: ${APPLE_API_KEY}" >&2
  exit 1
fi

# Resolve which version's artifacts to process.
if [[ -n "${VERSION_OVERRIDE}" ]]; then
  VERSION="${VERSION_OVERRIDE}"
else
  VERSION="$(node -p "require('${FRONTEND_DIR}/package.json').version")"
fi
echo "📦 Version: ${VERSION}"

NOTARY_ARGS=(--key "${APPLE_API_KEY}" --key-id "${APPLE_API_KEY_ID}" --issuer "${APPLE_API_ISSUER}")

# Collect the installers for this version only. We ship and notarize both the
# .dmg and the .pkg; the .zip (used for auto-update) is signed but not stapled —
# a zip has nowhere to attach a notarization ticket, and the app inside shares
# its CDHash with the notarized .dmg so it still passes Gatekeeper online.
shopt -s nullglob
INSTALLERS=(
  "${RELEASE_DIR}"/*-"${VERSION}"-mac-*.dmg
  "${RELEASE_DIR}"/*-"${VERSION}"-mac-*.pkg
)

if [[ ${#INSTALLERS[@]} -eq 0 ]]; then
  echo "❌ No .dmg/.pkg installers for version ${VERSION} found in ${RELEASE_DIR}" >&2
  exit 1
fi

# Phase 1: notarize every installer (no sudo needed).
for FILE in "${INSTALLERS[@]}"; do
  echo "📤 Notarizing $(basename "${FILE}")…"
  xcrun notarytool submit "${FILE}" "${NOTARY_ARGS[@]}" --wait
done

# Phase 2: staple every installer. No sudo needed (see header note).
for FILE in "${INSTALLERS[@]}"; do
  echo "📎 Stapling $(basename "${FILE}")…"
  xcrun stapler staple "${FILE}"
  echo "✅ $(basename "${FILE}") notarized and stapled."
done

echo "🎉 All installers notarized and stapled successfully!"
