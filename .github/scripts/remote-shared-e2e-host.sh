#!/usr/bin/env bash
set -euo pipefail

COMMAND="${1:-}"

if [[ -z "${COMMAND}" ]]; then
  echo "Usage: $0 <provision|status|cleanup|collect-diagnostics>" >&2
  exit 1
fi

REMOTE_E2E_WORKSPACE_ROOT="${REMOTE_E2E_WORKSPACE_ROOT:-/tmp/hedera-transaction-tool-shared-e2e}"
REMOTE_E2E_ENV_ID="${REMOTE_E2E_ENV_ID:?REMOTE_E2E_ENV_ID is required}"
REMOTE_E2E_ENV_DIR="${REMOTE_E2E_ENV_DIR:-${REMOTE_E2E_WORKSPACE_ROOT}/${REMOTE_E2E_ENV_ID}}"
REMOTE_E2E_BUNDLE_PATH="${REMOTE_E2E_BUNDLE_PATH:-${REMOTE_E2E_ENV_DIR}/repo-bundle.tgz}"
REMOTE_E2E_METADATA_PATH="${REMOTE_E2E_METADATA_PATH:-${REMOTE_E2E_ENV_DIR}/shared-e2e-env.json}"
REMOTE_E2E_LOG_DIR="${REMOTE_E2E_ENV_DIR}/logs"
REMOTE_E2E_ARTIFACTS_DIR="${REMOTE_E2E_ENV_DIR}/artifacts"
REMOTE_E2E_WORKTREE_DIR="${REMOTE_E2E_ENV_DIR}/workspace"
REMOTE_E2E_BACKEND_DIR="${REMOTE_E2E_WORKTREE_DIR}/back-end"
REMOTE_E2E_FRONTEND_PACKAGE_JSON="${REMOTE_E2E_WORKTREE_DIR}/front-end/package.json"
REMOTE_E2E_LOCK_FILE="${REMOTE_E2E_WORKSPACE_ROOT}/.shared-e2e.lock"
REMOTE_E2E_DIAGNOSTICS_ARCHIVE="${REMOTE_E2E_ENV_DIR}/diagnostics.tgz"

SOLO_CLUSTER_NAME="$(printf 'solo-%s' "${REMOTE_E2E_ENV_ID}" | tr -c '[:alnum:]-' '-' | cut -c1-40)"
SOLO_NAMESPACE="$(printf 'solo-%s' "${REMOTE_E2E_ENV_ID}" | tr -c '[:alnum:]-' '-' | cut -c1-40)"
SOLO_CLUSTER_SETUP_NAMESPACE="$(printf 'solo-cluster-%s' "${REMOTE_E2E_ENV_ID}" | tr -c '[:alnum:]-' '-' | cut -c1-40)"
SOLO_DEPLOYMENT="$(printf 'solo-deploy-%s' "${REMOTE_E2E_ENV_ID}" | tr -c '[:alnum:]-' '-' | cut -c1-40)"

export SOLO_CLUSTER_NAME SOLO_NAMESPACE SOLO_CLUSTER_SETUP_NAMESPACE SOLO_DEPLOYMENT

wait_for_tcp() {
  local host="$1"
  local port="$2"
  timeout 1 bash -c ">/dev/tcp/${host}/${port}" >/dev/null 2>&1
}

require_commands() {
  local missing=()
  local command

  for command in bash curl docker flock kind kubectl mkcert node npm socat tar; do
    if ! command -v "${command}" >/dev/null 2>&1; then
      missing+=("${command}")
    fi
  done

  if ! docker compose version >/dev/null 2>&1; then
    missing+=("docker compose")
  fi

  if [[ "${#missing[@]}" -gt 0 ]]; then
    printf 'Missing required commands on remote E2E host: %s\n' "${missing[*]}" >&2
    exit 1
  fi
}

ensure_directories() {
  mkdir -p "${REMOTE_E2E_ENV_DIR}" "${REMOTE_E2E_LOG_DIR}" "${REMOTE_E2E_ARTIFACTS_DIR}"
}

with_lock() {
  ensure_directories

  (
    flock 9
    "$@"
  ) 9>"${REMOTE_E2E_LOCK_FILE}"
}

create_kind_cluster_if_needed() {
  if kind get clusters | grep -Fx "${SOLO_CLUSTER_NAME}" >/dev/null 2>&1; then
    echo "Kind cluster ${SOLO_CLUSTER_NAME} already exists"
    return
  fi

  kind create cluster -n "${SOLO_CLUSTER_NAME}"
}

ensure_solo_cli() {
  if command -v solo >/dev/null 2>&1; then
    return
  fi

  npm install -g @hashgraph/solo
}

wait_for_solo_endpoints() {
  local attempt

  for attempt in $(seq 1 60); do
    if curl -fsS http://127.0.0.1:8080/api/v1/network/nodes >/dev/null 2>&1 && \
       curl -fsS http://127.0.0.1:8081/api/v1/network/nodes >/dev/null 2>&1 && \
       wait_for_tcp 127.0.0.1 50211 && \
       wait_for_tcp 127.0.0.1 5600; then
      return 0
    fi

    sleep 5
  done

  echo "Solo endpoints did not become ready in time" >&2
  return 1
}

start_socat_proxy() {
  local bind_host="$1"
  local listen_port="$2"
  local target_port="$3"
  local pid_file="${REMOTE_E2E_ENV_DIR}/socat-${listen_port}.pid"
  local log_file="${REMOTE_E2E_LOG_DIR}/socat-${listen_port}.log"

  if [[ -f "${pid_file}" ]]; then
    local existing_pid
    existing_pid="$(cat "${pid_file}")"
    if kill -0 "${existing_pid}" >/dev/null 2>&1; then
      return
    fi
  fi

  nohup socat \
    "TCP-LISTEN:${listen_port},bind=${bind_host},fork,reuseaddr" \
    "TCP:127.0.0.1:${target_port}" \
    >"${log_file}" 2>&1 &
  echo "$!" >"${pid_file}"
}

configure_bridge_proxies() {
  local docker_host_gateway

  docker_host_gateway="$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}')"
  if [[ -z "${docker_host_gateway}" ]]; then
    echo "Failed to resolve Docker bridge gateway IP" >&2
    exit 1
  fi

  start_socat_proxy "${docker_host_gateway}" 50211 50211
  start_socat_proxy "${docker_host_gateway}" 5600 5600
  start_socat_proxy "${docker_host_gateway}" 8081 8081

  sleep 2

  if ! curl -fsS "http://${docker_host_gateway}:8081/api/v1/network/nodes" >/dev/null 2>&1 || \
     ! wait_for_tcp "${docker_host_gateway}" 50211; then
    echo "Docker bridge proxies are not reachable" >&2
    exit 1
  fi
}

extract_bundle() {
  rm -rf "${REMOTE_E2E_WORKTREE_DIR}"
  mkdir -p "${REMOTE_E2E_WORKTREE_DIR}"
  tar -xzf "${REMOTE_E2E_BUNDLE_PATH}" -C "${REMOTE_E2E_WORKTREE_DIR}"
}

prepare_backend_env_files() {
  local dir

  cd "${REMOTE_E2E_BACKEND_DIR}"

  rm -rf cert
  mkdir -p cert
  mkcert -key-file cert/key.pem -cert-file cert/cert.pem localhost 127.0.0.1 ::1

  for dir in . apps/api apps/chain apps/notifications typeorm scripts; do
    cp "${dir}/example.env" "${dir}/.env"
  done

  local front_end_version
  front_end_version="$(node -p "require(process.argv[1]).version" "${REMOTE_E2E_FRONTEND_PACKAGE_JSON}")"

  sed -i "s/^LATEST_SUPPORTED_FRONTEND_VERSION=.*/LATEST_SUPPORTED_FRONTEND_VERSION=${front_end_version}/" apps/api/.env
  sed -i "s/^MINIMUM_SUPPORTED_FRONTEND_VERSION=.*/MINIMUM_SUPPORTED_FRONTEND_VERSION=${front_end_version}/" apps/api/.env
  sed -i "s/^MINIMUM_SUPPORTED_FRONTEND_VERSION=.*/MINIMUM_SUPPORTED_FRONTEND_VERSION=${front_end_version}/" apps/notifications/.env

  sed -i 's/^EMAIL_API_SECURE=.*/EMAIL_API_SECURE=false/' apps/notifications/.env
  sed -i 's/^ANONYMOUS_MINUTE_LIMIT=.*/ANONYMOUS_MINUTE_LIMIT=99999/' apps/api/.env
  sed -i 's/^ANONYMOUS_FIVE_SECOND_LIMIT=.*/ANONYMOUS_FIVE_SECOND_LIMIT=99999/' apps/api/.env
  sed -i 's/^GLOBAL_MINUTE_LIMIT=.*/GLOBAL_MINUTE_LIMIT=99999/' apps/api/.env
  sed -i 's/^GLOBAL_SECOND_LIMIT=.*/GLOBAL_SECOND_LIMIT=99999/' apps/api/.env
}

build_backend_images() {
  local service
  local attempt

  cd "${REMOTE_E2E_BACKEND_DIR}"
  export COMPOSE_PARALLEL_LIMIT=4

  for service in redis migration api chain notifications; do
    for attempt in $(seq 1 3); do
      if docker compose -f docker-compose.yaml build --progress plain "${service}"; then
        break
      fi

      if [[ "${attempt}" -eq 3 ]]; then
        echo "docker compose build failed for ${service} after 3 attempts" >&2
        exit 1
      fi

      sleep 15
    done
  done
}

start_backend_services() {
  local attempt

  cd "${REMOTE_E2E_BACKEND_DIR}"

  for attempt in $(seq 1 5); do
    if docker compose -f docker-compose.yaml up -d --no-build api chain notifications; then
      break
    fi

    if [[ "${attempt}" -eq 5 ]]; then
      echo "docker compose up failed after 5 attempts" >&2
      docker compose -f docker-compose.yaml ps || true
      docker compose -f docker-compose.yaml logs --tail=200 || true
      exit 1
    fi

    sleep 15
  done
}

wait_for_backend() {
  local attempt
  local code

  cd "${REMOTE_E2E_BACKEND_DIR}"

  for attempt in $(seq 1 60); do
    code="$(curl -k -s -o /dev/null -w '%{http_code}' https://127.0.0.1:3001/ 2>/dev/null || echo '000')"
    if [[ "${code}" == "200" || "${code}" == "426" ]]; then
      return 0
    fi

    if [[ "${attempt}" -eq 60 ]]; then
      echo "Back-end did not become ready in time" >&2
      docker compose -f docker-compose.yaml ps || true
      docker compose -f docker-compose.yaml logs --tail=300 || true
      return 1
    fi

    sleep 5
  done
}

write_metadata() {
  cat >"${REMOTE_E2E_METADATA_PATH}" <<EOF
{
  "environmentId": "${REMOTE_E2E_ENV_ID}",
  "organizationUrl": "https://localhost:3001",
  "postgresHost": "localhost",
  "postgresPort": 5432,
  "postgresDatabase": "postgres",
  "postgresUsername": "postgres",
  "postgresPassword": "postgres",
  "mirrorNodeRestUrl": "http://localhost:8081/api/v1",
  "mirrorNodeGrpcHost": "localhost",
  "mirrorNodeGrpcPort": 5600,
  "localNodeHost": "127.0.0.1",
  "localNodePort": 50211,
  "localNodeAccountId": "0.0.3",
  "localNodeLedgerId": "3"
}
EOF
}

provision_impl() {
  require_commands
  ensure_solo_cli
  ensure_directories
  extract_bundle
  create_kind_cluster_if_needed

  if ! status_impl >/dev/null 2>&1; then
    solo one-shot single deploy | tee "${REMOTE_E2E_LOG_DIR}/solo-deploy.log"
    wait_for_solo_endpoints
    configure_bridge_proxies
    prepare_backend_env_files
    build_backend_images
    start_backend_services
    wait_for_backend
  fi

  write_metadata
}

status_impl() {
  if [[ ! -f "${REMOTE_E2E_METADATA_PATH}" ]]; then
    return 1
  fi

  curl -fsS http://127.0.0.1:8081/api/v1/network/nodes >/dev/null 2>&1
  wait_for_tcp 127.0.0.1 50211
  wait_for_tcp 127.0.0.1 5600

  local code
  code="$(curl -k -s -o /dev/null -w '%{http_code}' https://127.0.0.1:3001/ 2>/dev/null || echo '000')"
  [[ "${code}" == "200" || "${code}" == "426" ]]
}

cleanup_impl() {
  if [[ -d "${REMOTE_E2E_BACKEND_DIR}" ]]; then
    (
      cd "${REMOTE_E2E_BACKEND_DIR}"
      docker compose -f docker-compose.yaml down --volumes --remove-orphans || true
    )
  fi

  local pid_file
  for pid_file in "${REMOTE_E2E_ENV_DIR}"/socat-*.pid; do
    if [[ -f "${pid_file}" ]]; then
      kill "$(cat "${pid_file}")" >/dev/null 2>&1 || true
      rm -f "${pid_file}"
    fi
  done

  kind delete cluster -n "${SOLO_CLUSTER_NAME}" >/dev/null 2>&1 || true
  rm -rf "${REMOTE_E2E_ENV_DIR}"
}

collect_diagnostics_impl() {
  ensure_directories
  rm -rf "${REMOTE_E2E_ARTIFACTS_DIR}"
  mkdir -p "${REMOTE_E2E_ARTIFACTS_DIR}"

  if [[ -d "${REMOTE_E2E_BACKEND_DIR}" ]]; then
    (
      cd "${REMOTE_E2E_BACKEND_DIR}"
      docker compose -f docker-compose.yaml ps >"${REMOTE_E2E_ARTIFACTS_DIR}/backend-ps.txt" 2>&1 || true
      docker compose -f docker-compose.yaml logs --tail=300 >"${REMOTE_E2E_ARTIFACTS_DIR}/backend-compose.log" 2>&1 || true
      docker compose -f docker-compose.yaml logs --tail=300 api >"${REMOTE_E2E_ARTIFACTS_DIR}/backend-api.log" 2>&1 || true
    )
  fi

  kubectl get pods -A -o wide >"${REMOTE_E2E_ARTIFACTS_DIR}/solo-pods.txt" 2>&1 || true
  kubectl get events -A --sort-by=.lastTimestamp >"${REMOTE_E2E_ARTIFACTS_DIR}/solo-events.txt" 2>&1 || true
  kubectl logs -A --all-containers --tail=500 >"${REMOTE_E2E_ARTIFACTS_DIR}/solo-logs.txt" 2>&1 || true

  tar -czf "${REMOTE_E2E_DIAGNOSTICS_ARCHIVE}" -C "${REMOTE_E2E_ENV_DIR}" artifacts logs
}

case "${COMMAND}" in
  provision)
    with_lock provision_impl
    ;;
  status)
    status_impl
    ;;
  cleanup)
    with_lock cleanup_impl
    ;;
  collect-diagnostics)
    with_lock collect_diagnostics_impl
    ;;
  *)
    echo "Unknown command: ${COMMAND}" >&2
    exit 1
    ;;
esac
