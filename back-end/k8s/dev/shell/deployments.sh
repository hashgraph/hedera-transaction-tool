BASEDIR=$(dirname "$0")

# CONSTANTS scripts paths
CONSTANTS_SCRIPT=$(realpath "$BASEDIR/shell/constants.sh")

# Source the CONSTANTS scripts
. "$CONSTANTS_SCRIPT"

# Deploy the Postgres deployment
deploy() {
    echo "\nDeploying $1 deployment..."
    
    local deployment_yaml=$(realpath "$BASEDIR/deployments/$1.yaml")

    $KUBECTL apply -f "$deployment_yaml"
}

# Delete the deployment
delete_deployment() {
    $KUBECTL delete deployments "$1"
}

# Delete the service
delete_service() {
    $KUBECTL delete services "$1"
}

# Check traefik helm repo
assert_traefik_helm_repo() {
    echo "\nChecking Traefik Helm repo..."
    if [ $(Helm repo list | tail -n +2 | grep -ic "traefik") -eq 0 ]; then
        echo "\nAdding Traefik Helm repo..."
        $HELM repo add traefik https://helm.traefik.io/traefik
    else 
        echo "\nUpdating Traefik Helm repo..."
        $HELM repo update traefik
    fi
}

# Install Traefik release
assert_traefik_release() {
    echo "\nInstalling Traefik release..."

    if [ $(HELM list | tail -n +2 | grep -ic "traefik") -gt 0 ]; then
        $HELM uninstall traefik
    fi

    helm install traefik traefik/traefik
}

# Apply Ingress
assert_ingress() {
    echo "\nApplying Ingress..."

    local ingress_yaml=$(realpath "$BASEDIR/ingress.yaml")

    $KUBECTL apply -f "$ingress_yaml"
}

# Port forward the Postgres
port_forward_postgres() {
    echo "\nPort forwarding Postgres..."
    
    local port=5432
    while lsof -i tcp:$port >/dev/null; do
        port=$((port + 1))
    done
    $KUBECTL port-forward service/postgres-service $port:5432
}

# Wait for deployment
wait_for() {
    echo "\nWaiting for $2 $1 to be ready..."
    $KUBECTL wait --for=condition=available --timeout=5000s $1/$2
    echo "\n$2 $1 is ready."
}

# Wait for postgres deployment
wait_for_traefik() {
    wait_for "deployment" "traefik"
}

# Deploy all
deploy_all() {
    echo "\nDeploying Kubernetes deployments...\n"
    deploy "postgres-deployment"
    deploy "redis-deployment"
    deploy "rabbitmq-deployment"

    wait_for "deployment" "postgres-deployment"
    wait_for "deployment" "redis-deployment"
    wait_for "deployment" "rabbitmq-deployment"

    deploy "api-deployment"
    deploy "chain-deployment"
    deploy "notifications-deployment"
}

stop_all() {
    echo "\nStopping Kubernetes deployments...\n"
    delete_deployment "postgres-deployment"
    delete_deployment "redis-deployment"
    delete_deployment "rabbitmq-deployment"
    delete_deployment "api-deployment"
    delete_deployment "chain-deployment"
    delete_deployment "notifications-deployment"
    
    delete_service "api-service"
    delete_service "api-http-service"
    delete_service "notifications-service"
    delete_service "postgres-service"
    delete_service "rabbitmq-service"
    delete_service "redis-service"

    $KUBECTL delete ingresses back-end

    $HELM uninstall traefik
}