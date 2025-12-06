# Function to display usage information
usage() {
  echo "Usage: $0 [--skip-build]"
  echo "  --skip-build      Skip the build step"
  exit 1
}

# Initialize variables
SKIP_BUILD=false

# Parse command-line options
while [[ "$1" =~ ^- && ! "$1" == "--" ]]; do case $1 in
  --skip-build )
    SKIP_BUILD=true
    ;;
  -h | --help )
    usage
    ;;
  * )
    echo "Unknown option: $1"
    usage
    ;;
esac; shift; done
if [[ "$1" == '--' ]]; then shift; fi

BASEDIR=$(dirname "$0")

# Load environment variables from .env
ENV_FILE=$(realpath "$BASEDIR/.env")
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
fi

# Validate
VALIDATE_SCRIPT=$(realpath "$BASEDIR/shell/validate.sh")
SECRETS_SCRIPT=$(realpath "$BASEDIR/shell/secrets.sh")
DOCKER_IMAGES_SCRIPT=$(realpath "$BASEDIR/shell/docker_images.sh")
DEPLOYMENTS_SCRIPT=$(realpath "$BASEDIR/shell/deployments.sh")

# Source the validate script
. "$VALIDATE_SCRIPT"

validate_kubectl
validate_cluster
validate_helm

# Source the secrets script
. "$SECRETS_SCRIPT"

assert_email_api_secret
assert_tls_secret

# Source the docker images script
. "$DOCKER_IMAGES_SCRIPT"

# Check Docker images
if [ "$SKIP_BUILD" = true ]; then
    assert_docker_images --skip-build
else
    assert_docker_images
fi

# Source the docker images script
. "$DEPLOYMENTS_SCRIPT"

# Create a clean function
clean() {
  stop_all
  exit 0
}

# Invoke the clean function on the following signals
trap clean SIGINT SIGQUIT SIGTERM

# Deploy Kubernetes deployments
if [ -n "$K8S_CONTEXT" ]; then
    deploy_all "$K8S_CONTEXT"
else
    deploy_all
fi

# Asserts that Traefik Helm repo is installed
assert_traefik_helm_repo

# Asserts the Traefik release is installed
assert_traefik_release

# Waits for the Traefik deployment to be ready
wait_for_traefik

# Apply the Ingress
assert_ingress

# Port forward the Postgres
port_forward_postgres

exit 0