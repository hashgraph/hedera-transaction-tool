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

# should pull name from .env
# Check and switch to correct context
assert_k8s_context() {
    local target_context="$1"
    local current_context=$($KUBECTL config current-context 2>/dev/null)

    if [ "$current_context" != "$target_context" ]; then
        echo "\nSwitching from context '$current_context' to '$target_context'..."
        $KUBECTL config use-context "$target_context"

        if [ $? -ne 0 ]; then
            echo "\nError: Failed to switch to context '$target_context'"
            exit 1
        fi
    else
        echo "\nAlready using context: $target_context"
    fi
}

# Ensure NATS Helm repo is present and up-to-date
assert_nats_helm_repo() {
    echo "\nChecking NATS Helm repo..."
    if [ $($HELM repo list | tail -n +2 | grep -ic "nats") -eq 0 ]; then
        echo "\nAdding NATS Helm repo..."
        $HELM repo add nats https://nats-io.github.io/k8s/helm/charts
    else
        echo "\nUpdating NATS Helm repo..."
        $HELM repo update nats
    fi
}

# Install NATS with JetStream enabled (uninstall existing release first)
assert_nats_release() {
    echo "\nInstalling NATS release with JetStream enabled..."

    if [ $($HELM list | tail -n +2 | grep -ic "nats") -gt 0 ]; then
        $HELM uninstall nats
    fi

    local nats_values_yaml=$(realpath "$BASEDIR/deployments/nats-values.yaml")

    # In a normal install, we might want exporter and reloader
    # For a full dev, we want all of them, I think.
    $HELM install nats nats/nats -f "$nats_values_yaml"
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
    if [ "$1" = "statefulset" ]; then
        # For StatefulSets, wait for pods to be ready
        $KUBECTL wait --for=condition=ready pod -l app.kubernetes.io/name=$2 --timeout=180s
    else
        # For Deployments, use condition=available
        $KUBECTL wait --for=condition=available --timeout=180s $1/$2
    fi
}

# Wait for postgres deployment
wait_for_nats() {
    wait_for "statefulset" "nats"
}

# Wait for postgres deployment
wait_for_traefik() {
    wait_for "deployment" "traefik"
}

# Deploy all
deploy_all() {
    # Only assert context if argument is provided
    if [ -n "$1" ]; then
        assert_k8s_context "$1"
    fi

    echo "\nDeploying Kubernetes deployments...\n"
    deploy "postgres-deployment"
    deploy "redis-deployment"

    wait_for "deployment" "postgres-deployment"
    wait_for "deployment" "redis-deployment"

    deploy "api-deployment"
    deploy "chain-deployment"
    deploy "notifications-deployment"
}

stop_all() {
    echo "\nStopping Kubernetes deployments...\n"
    delete_deployment "postgres-deployment"
    delete_deployment "redis-deployment"
    delete_deployment "api-deployment"
    delete_deployment "chain-deployment"
    delete_deployment "notifications-deployment"
    
    delete_service "api-service"
    delete_service "api-http-service"
    delete_service "notifications-service"
    delete_service "postgres-service"
    delete_service "redis-service"

    $KUBECTL delete ingresses back-end

    $HELM uninstall nats
    $HELM uninstall traefik
}