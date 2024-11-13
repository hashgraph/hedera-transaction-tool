# Source the UTILS, CONSTANTS scripts
UTILS_SCRIPT=utils.sh
CONSTANTS_SCRIPT=constants.sh
. "./shell/$UTILS_SCRIPT"
. "./shell/$CONSTANTS_SCRIPT"

# Check if the Brevo secret exists
brevo_secret_exists() {
    if [ $(KUBECTL get secrets | tail -n +2 | grep -ic "brevo-secret") -gt 0 ]; then
        return 1
    else
        return 0
    fi
}

# Create the Brevo secret if not exists
assert_brevo_secret() {
    echo "\nChecking if Brevo secret exists..."

    brevo_secret_exists
    if [ $? -gt 0 ]; then
        return 1
    fi

    local brevo_secret_path=$(realpath "./deployments/brevo-secret.yaml")
    if [ ! -f "$brevo_secret_path" ]; then
        with_error "The Brevo secret (brevo-secret.yaml) file does not exist, you should create one from the brevo-secret.example.yaml"
        exit 1
    fi

    # Validate that the Brevo secret YAML file contains values
    local has_username=$(grep -c 'username: ' "$brevo_secret_path")
    local has_password=$(grep -c 'password: ' "$brevo_secret_path")
    if [ $has_username -eq 0 ] || [ $has_password -eq 0 ]; then
        with_error "The Brevo secret (brevo-secret.yaml) file does not contain the required values"
        if [ $has_username -eq 0 ]; then
            echo "username is missing"
        fi
        if [ $has_password -eq 0 ]; then
            echo "password is missing"
        fi
        exit 1
    fi

    # Apply the Brevo secret
    $KUBECTL apply -f "$brevo_secret_path"

    echo "Brevo secret validation passed."
}

# Check if the TLS secret exists
tls_secret_exists() {
    if [ $(KUBECTL get secrets | tail -n +2 | grep -ic "kubernetes.io/tls") -gt 0 ]; then
        return 1
    else
        return 0
    fi
}

# Create the TLS secret if not exists
assert_tls_secret() {
    echo "Checking if TLS secret exists..."

    tls_secret_exists
    if [ $? -gt 0 ]; then
        return 1
    fi

    local default_cert_path=$(realpath "../../cert/cert.pem")
    local default_key_path=$(realpath "../../cert/key.pem")

    echo ""
    read -p "Enter the certificate path [DEFAULT: $default_cert_path]: " certPath
    certPath=${certPath:-$default_cert_path}

    read -p "Enter the key path [DEFAULT: $default_key_path]: " keyPath
    keyPath=${keyPath:-$default_key_path}

    echo ""
    $KUBECTL create secret tls self-signed-certificate --cert="$certPath" --key="$keyPath"
}