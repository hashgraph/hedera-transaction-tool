#!/usr/bin/env bash
set -euo pipefail

COMMAND="${1:-}"

if [[ -z "${COMMAND}" ]]; then
  echo "Usage: $0 <provision|ensure|status|open-tunnels|close-tunnels|cleanup|collect-diagnostics|write-metadata>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REMOTE_HOST_SCRIPT="${SCRIPT_DIR}/remote-shared-e2e-host.sh"

REMOTE_E2E_SSH_HOST="${REMOTE_E2E_SSH_HOST:?REMOTE_E2E_SSH_HOST is required}"
REMOTE_E2E_SSH_USER="${REMOTE_E2E_SSH_USER:?REMOTE_E2E_SSH_USER is required}"
REMOTE_E2E_SSH_PORT="${REMOTE_E2E_SSH_PORT:-22}"
REMOTE_E2E_WORKSPACE_ROOT="${REMOTE_E2E_WORKSPACE_ROOT:-/tmp/hedera-transaction-tool-shared-e2e}"
REMOTE_E2E_ENV_ID="${REMOTE_E2E_ENV_ID:-shared-e2e-${GITHUB_RUN_ID:-local}}"
REMOTE_E2E_ENV_DIR="${REMOTE_E2E_WORKSPACE_ROOT}/${REMOTE_E2E_ENV_ID}"
REMOTE_E2E_BUNDLE_PATH="${REMOTE_E2E_BUNDLE_PATH:-${RUNNER_TEMP:-/tmp}/${REMOTE_E2E_ENV_ID}-repo-bundle.tgz}"
REMOTE_E2E_METADATA_PATH="${REMOTE_E2E_METADATA_PATH:-${RUNNER_TEMP:-/tmp}/${REMOTE_E2E_ENV_ID}-metadata.json}"
REMOTE_E2E_TUNNEL_SOCKET="${REMOTE_E2E_TUNNEL_SOCKET:-${RUNNER_TEMP:-/tmp}/${REMOTE_E2E_ENV_ID}.sock}"
REMOTE_E2E_DIAGNOSTICS_PATH="${REMOTE_E2E_DIAGNOSTICS_PATH:-${RUNNER_TEMP:-/tmp}/${REMOTE_E2E_ENV_ID}-diagnostics.tgz}"

SSH_TARGET="${REMOTE_E2E_SSH_USER}@${REMOTE_E2E_SSH_HOST}"
SSH_ARGS=(
  -o BatchMode=yes
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=6
  -o StrictHostKeyChecking=yes
)
SSH_PORT_ARGS=(-p "${REMOTE_E2E_SSH_PORT}")
SCP_PORT_ARGS=(-P "${REMOTE_E2E_SSH_PORT}")

wait_for_tcp() {
  local host="$1"
  local port="$2"
  timeout 1 bash -c ">/dev/tcp/${host}/${port}" >/dev/null 2>&1
}

remote_host_command() {
  local command="$1"

  ssh "${SSH_PORT_ARGS[@]}" "${SSH_ARGS[@]}" "${SSH_TARGET}" \
    "REMOTE_E2E_ENV_ID='${REMOTE_E2E_ENV_ID}' REMOTE_E2E_WORKSPACE_ROOT='${REMOTE_E2E_WORKSPACE_ROOT}' REMOTE_E2E_ENV_DIR='${REMOTE_E2E_ENV_DIR}' REMOTE_E2E_BUNDLE_PATH='${REMOTE_E2E_ENV_DIR}/repo-bundle.tgz' REMOTE_E2E_METADATA_PATH='${REMOTE_E2E_ENV_DIR}/shared-e2e-env.json' bash -s -- '${command}'" \
    < "${REMOTE_HOST_SCRIPT}"
}

create_bundle() {
  tar -czf "${REMOTE_E2E_BUNDLE_PATH}" \
    --exclude='back-end/node_modules' \
    --exclude='back-end/dist' \
    --exclude='back-end/cert' \
    --exclude='back-end/pgdata' \
    --exclude='back-end/combined.log' \
    -C "${REPO_ROOT}" \
    back-end \
    front-end/package.json
}

upload_bundle() {
  ssh "${SSH_PORT_ARGS[@]}" "${SSH_ARGS[@]}" "${SSH_TARGET}" "mkdir -p '${REMOTE_E2E_ENV_DIR}'"
  scp "${SCP_PORT_ARGS[@]}" "${SSH_ARGS[@]}" "${REMOTE_E2E_BUNDLE_PATH}" "${SSH_TARGET}:${REMOTE_E2E_ENV_DIR}/repo-bundle.tgz"
}

download_metadata() {
  ssh "${SSH_PORT_ARGS[@]}" "${SSH_ARGS[@]}" "${SSH_TARGET}" "cat '${REMOTE_E2E_ENV_DIR}/shared-e2e-env.json'" > "${REMOTE_E2E_METADATA_PATH}"
}

write_metadata() {
  download_metadata
}

provision() {
  create_bundle
  upload_bundle
  remote_host_command provision
  download_metadata
}

status() {
  remote_host_command status
}

ensure() {
  if status; then
    download_metadata
    return
  fi

  provision
}

wait_for_local_endpoints() {
  local attempt

  for attempt in $(seq 1 30); do
    if curl -k -s -o /dev/null -w '%{http_code}' https://localhost:3001/ 2>/dev/null | grep -Eq '^(200|426)$' && \
       curl -fsS http://localhost:8081/api/v1/network/nodes >/dev/null 2>&1 && \
       wait_for_tcp 127.0.0.1 50211 && \
       wait_for_tcp 127.0.0.1 5600; then
      return 0
    fi

    sleep 2
  done

  echo "Forwarded shared E2E environment is not reachable on localhost" >&2
  return 1
}

open_tunnels() {
  rm -f "${REMOTE_E2E_TUNNEL_SOCKET}"

  ssh "${SSH_PORT_ARGS[@]}" "${SSH_ARGS[@]}" \
    -M \
    -S "${REMOTE_E2E_TUNNEL_SOCKET}" \
    -fnNT \
    -L 3001:127.0.0.1:3001 \
    -L 5432:127.0.0.1:5432 \
    -L 8080:127.0.0.1:8080 \
    -L 8081:127.0.0.1:8081 \
    -L 50211:127.0.0.1:50211 \
    -L 5600:127.0.0.1:5600 \
    "${SSH_TARGET}"

  wait_for_local_endpoints
}

close_tunnels() {
  if [[ ! -S "${REMOTE_E2E_TUNNEL_SOCKET}" ]]; then
    return 0
  fi

  ssh "${SSH_PORT_ARGS[@]}" "${SSH_ARGS[@]}" -S "${REMOTE_E2E_TUNNEL_SOCKET}" -O exit "${SSH_TARGET}" >/dev/null 2>&1 || true
  rm -f "${REMOTE_E2E_TUNNEL_SOCKET}"
}

cleanup() {
  remote_host_command cleanup
}

collect_diagnostics() {
  remote_host_command collect-diagnostics
  scp "${SCP_PORT_ARGS[@]}" "${SSH_ARGS[@]}" "${SSH_TARGET}:${REMOTE_E2E_ENV_DIR}/diagnostics.tgz" "${REMOTE_E2E_DIAGNOSTICS_PATH}"
}

case "${COMMAND}" in
  provision)
    provision
    ;;
  ensure)
    ensure
    ;;
  status)
    status
    ;;
  open-tunnels)
    open_tunnels
    ;;
  close-tunnels)
    close_tunnels
    ;;
  cleanup)
    cleanup
    ;;
  collect-diagnostics)
    collect_diagnostics
    ;;
  write-metadata)
    write_metadata
    ;;
  *)
    echo "Unknown command: ${COMMAND}" >&2
    exit 1
    ;;
esac
