BASEDIR=$(dirname "$0")

# UTILS, CONSTANTS scripts paths
UTILS_SCRIPT=$(realpath "$BASEDIR/shell/utils.sh")
CONSTANTS_SCRIPT=$(realpath "$BASEDIR/shell/constants.sh")

# Source the UTILS, CONSTANTS scripts
. "$UTILS_SCRIPT"
. "$CONSTANTS_SCRIPT"

# Check if the email api secret exists
email_api_secret_exists() {
    if [ $(KUBECTL get secrets | tail -n +2 | grep -ic "email-api-secret") -gt 0 ]; then
        return 1
    else
        return 0
    fi
}

# Create the email api secret if not exists
assert_email_api_secret() {
    echo "\nChecking if email api secret exists..."

    email_api_secret_exists
    if [ $? -gt 0 ]; then
        return 1
    fi

    local email_api_secret_path=$(realpath "$BASEDIR/deployments/email-api-secret.yaml")
    if [ ! -f "$email_api_secret_path" ]; then
        with_error "The email api secret (email-api-secret.yaml) file does not exist, you should create one from the email-api-secret.example.yaml"
        exit 1
    fi

    # Validate that the email api secret YAML file contains values
    local has_host=$(grep -c 'host: ' "$email_api_secret_path")
    local has_port=$(grep -c 'port: ' "$email_api_secret_path")
    local has_secure=$(grep -c 'secure: ' "$email_api_secret_path")
    local has_username=$(grep -c 'username: ' "$email_api_secret_path")
    local has_password=$(grep -c 'password: ' "$email_api_secret_path")
    local has_sender_email=$(grep -c 'sender-email: ' "$email_api_secret_path")
    if [ $has_host -eq 0 ] || \
       [ $has_port -eq 0 ] || \
       [ $has_secure -eq 0 ] || \
       [ $has_username -eq 0 ] || \
       [ $has_password -eq 0 ] || \
       [ $has_sender_email -eq 0 ]; then
        with_error "The email api secret (email-api-secret.yaml) file does not contain the required values"
        if [ $has_host -eq 0 ]; then
            echo "host is missing"
        fi
        if [ $has_port -eq 0 ]; then
            echo "port is missing"
        fi
        if [ $has_secure -eq 0 ]; then
            echo "secure is missing"
        fi
        if [ $has_username -eq 0 ]; then
            echo "username is missing"
        fi
        if [ $has_password -eq 0 ]; then
            echo "password is missing"
        fi
        if [ $has_sender_email -eq 0 ]; then
            echo "sender-email is missing"
        fi
        exit 1
    fi

    # Apply the email api secret
    $KUBECTL apply -f "$email_api_secret_path"

    echo "email api secret validation passed."
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
    echo "\nChecking if TLS secret exists..."

    tls_secret_exists
    if [ $? -gt 0 ]; then
        return 1
    fi

    local default_cert_path=$(realpath "$BASEDIR/../../cert/cert.pem")
    local default_key_path=$(realpath "$BASEDIR/../../cert/key.pem")

    echo ""
    read -p "Enter the certificate path [DEFAULT: $default_cert_path]: " certPath
    certPath=${certPath:-$default_cert_path}

    read -p "Enter the key path [DEFAULT: $default_key_path]: " keyPath
    keyPath=${keyPath:-$default_key_path}

    echo ""
    $KUBECTL create secret tls self-signed-certificate --cert="$certPath" --key="$keyPath"
}