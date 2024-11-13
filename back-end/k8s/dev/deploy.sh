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

# Validate
VALIDATE_SCRIPT="./shell/validate.sh"
SECRETS_SCRIPT="./shell/secrets.sh"
DOCKER_IMAGES_SCRIPT="./shell/docker_images.sh"
DEPLOYMENTS_SCRIPT="./shell/deployments.sh"

# Change the permission to be executable
chmod 755 $VALIDATE_SCRIPT
# Source the validate script
. $VALIDATE_SCRIPT

validate_kubectl
validate_cluster
validate_helm

# Change the permission to be executable
chmod 755 $SECRETS_SCRIPT
# Sorce the secrets script
. $SECRETS_SCRIPT

assert_brevo_secret
assert_tls_secret

# Change the permission to be executable
chmod 755 $DOCKER_IMAGES_SCRIPT
# Source the docker images script
. $DOCKER_IMAGES_SCRIPT

# Check Docker images
if [ "$SKIP_BUILD" = true ]; then
    assert_docker_images --skip-build
else
    assert_docker_images
fi

# Change the permission to be executable
chmod 755 $DEPLOYMENTS_SCRIPT
# Source the docker images script
. $DEPLOYMENTS_SCRIPT

deploy_all

assert_traefik_helm_repo
assert_traefik_release

wait_for_traefik

assert_ingress

port_forward_postgres

stop_all

exit 0