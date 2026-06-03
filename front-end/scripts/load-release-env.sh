#!/usr/bin/env bash
# Sourced by build-mac.sh and notarize-mac-installers.sh.
#
# Loads scripts/release.env (gitignored) into the environment so local release
# runs pick up the signing + notarization credentials automatically. In CI the
# file is absent and the same variables are provided by the workflow env, so
# this is a no-op there.
#
# Values already present in the environment are NOT overwritten, so a CI run or
# an explicit `export` in your shell always wins over the file.
#
# Parsed line-by-line (not `source`d) so values with spaces — e.g. a .p8/.p12
# path containing spaces — work without quoting and can't be executed as
# commands.

_release_env_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_release_env_file="${_release_env_dir}/release.env"

if [[ -f "${_release_env_file}" ]]; then
  echo "🔐 Loading credentials from ${_release_env_file}"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"                       # strip trailing CR (CRLF files)
    line="${line#"${line%%[![:space:]]*}"}"    # strip leading whitespace
    [[ -z "${line}" || "${line}" == \#* ]] && continue
    [[ "${line}" != *=* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key//[[:space:]]/}"                 # env names have no spaces
    val="${val%\"}"; val="${val#\"}"           # strip one pair of surrounding quotes
    val="${val%\'}"; val="${val#\'}"
    [[ -n "${!key:-}" ]] && continue           # don't clobber the existing env (CI/shell wins)
    export "${key}=${val}"
  done < "${_release_env_file}"
fi
