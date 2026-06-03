#!/usr/bin/env bash
# Build + SIGN the macOS artifacts (.app, .dmg, .zip, .pkg) with electron-builder.
#
# This step only builds and signs — it does NOT notarize. Run `pnpm notarize:mac`
# afterward to notarize + staple.
#
# Signing uses the Developer ID Application cert (app/dmg/zip) and the Developer
# ID Installer cert (pkg), read from the CSC_* environment variables:
#   CSC_LINK / CSC_KEY_PASSWORD                     -> Developer ID Application
#   CSC_INSTALLER_LINK / CSC_INSTALLER_KEY_PASSWORD -> Developer ID Installer
# Locally these come from a gitignored scripts/release.env (see
# release.env.example); in CI they come from the workflow env. electron-builder
# imports the .p12 files into a temporary keychain just for the build, so your
# login keychain is never touched and no auth prompts appear mid-build. No sudo
# is required.
#
# Any extra args are passed straight through to electron-builder, e.g.
#   bash scripts/build-mac.sh default --arm64

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./load-release-env.sh
source "${SCRIPT_DIR}/load-release-env.sh"

cd "${SCRIPT_DIR}/.."
exec pnpm exec electron-builder --mac "$@"
