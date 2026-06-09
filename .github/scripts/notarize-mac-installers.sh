#!/usr/bin/env bash
# Notarize and staple the macOS installer artifacts (.dmg and .pkg).
#
# Expects these env vars to already be set (CI exports them before calling):
#   APPLE_API_KEY     path to the AuthKey_XXXX.p8 file
#   APPLE_API_KEY_ID  the key ID
#   APPLE_API_ISSUER  the issuer UUID
#
# Optionally pass -v <version> to override the version read from package.json.

set -euo pipefail

usage() {
  echo "Usage: $0 [-v <version>]"
  exit 1
}

VERSION_OVERRIDE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--version) VERSION_OVERRIDE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if [[ -z "${APPLE_API_KEY:-}" || -z "${APPLE_API_KEY_ID:-}" || -z "${APPLE_API_ISSUER:-}" ]]; then
  echo "Missing credentials: set APPLE_API_KEY, APPLE_API_KEY_ID, and APPLE_API_ISSUER." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/../../front-end" && pwd)"
RELEASE_DIR="${FRONTEND_DIR}/release"

if [[ -n "${VERSION_OVERRIDE}" ]]; then
  VERSION="${VERSION_OVERRIDE}"
else
  VERSION="$(node -p "require('${FRONTEND_DIR}/package.json').version")"
fi
echo "Version: ${VERSION}"

NOTARY_ARGS=(--key "${APPLE_API_KEY}" --key-id "${APPLE_API_KEY_ID}" --issuer "${APPLE_API_ISSUER}")

shopt -s nullglob
INSTALLERS=(
  "${RELEASE_DIR}"/*-"${VERSION}"-mac-*.dmg
  "${RELEASE_DIR}"/*-"${VERSION}"-mac-*.pkg
)

if [[ ${#INSTALLERS[@]} -eq 0 ]]; then
  echo "No .dmg/.pkg installers for version ${VERSION} found in ${RELEASE_DIR}" >&2
  exit 1
fi

for FILE in "${INSTALLERS[@]}"; do
  echo "Notarizing $(basename "${FILE}")…"
  xcrun notarytool submit "${FILE}" "${NOTARY_ARGS[@]}" --wait
done

for FILE in "${INSTALLERS[@]}"; do
  echo "Stapling $(basename "${FILE}")…"
  xcrun stapler staple "${FILE}"
  echo "Done: $(basename "${FILE}")"
done

echo "All installers notarized and stapled successfully."
