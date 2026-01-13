BASEDIR=$(dirname "$0")

# CONSTANTS scripts paths
CONSTANTS_SCRIPT=$(realpath "$BASEDIR/shell/constants.sh")

# Source the CONSTANTS scripts
. "$CONSTANTS_SCRIPT"

# Check if Docker image exists
docker_image_exist() {
    if [ -z "$($DOCKER images -q $1 2> /dev/null)" ]; then
        return 0
    fi
    return 1
}

# Assert that the Docker images exist
assert_docker_images() {
    echo "\nChecking if Docker images exist..."

    local api_name="api"
    local chain_name="chain"
    local notifications_name="notifications"
    local migration_name="migration"

    local apps_path=$(realpath "$BASEDIR/../../apps")
    local typeorm_path=$(realpath "$BASEDIR/../../typeorm")
    local context_path=$(realpath "$BASEDIR/../..")

    for name in $api_name $chain_name $notifications_name
    do
        image_name="back-end-$name:1.0.0"
        docker_image_exist $image_name
        if [[ $? -eq 0 || ! $1 = '--skip-build' ]]; then
            echo "Building Docker image for $name..."
            $DOCKER build -t $image_name -f "$apps_path/$name/Dockerfile" "$context_path"
        fi
    done

    image_name="back-end-$migration_name:1.0.0"
    docker_image_exist $image_name
    if [[ $? -eq 0 || ! "$1" = '--skip-build' ]]; then
        echo "Building Docker image for migration..."
        $DOCKER build -t $image_name -f "$typeorm_path/Dockerfile" "$context_path"
    fi
}