# Source the UTILS, CONSTANTS scripts
UTILS_SCRIPT=utils.sh
CONSTANTS_SCRIPT=constants.sh
. "./shell/$UTILS_SCRIPT"
. "./shell/$CONSTANTS_SCRIPT"

# Ensure that the kubectl exists
validate_kubectl() {
    echo "Checking if kubectl exists"

    check_if_exists "$KUBECTL"
    if  [ $? = 0 ]; then
        with_error "kubectl (Kubernetes CLI) does not exist"
        exit 127
    fi
}

# Ensure that the Kubernetes cluster is running
validate_cluster() {
    echo "Checking if Kubernetes cluster is running"

    if [ $(KUBECTL get nodes | tail -n +2 | grep -ic "ready") -eq 0 ]; then
        with_error "The Kubernetes cluster is not running"
        exit 1
    fi
}

validate_helm() {
    echo "Checking if Helm exists"

    check_if_exists "$HELM"
    if  [ $? = 0 ]; then
        with_error "Helm does not exist"
        exit 127
    fi
}