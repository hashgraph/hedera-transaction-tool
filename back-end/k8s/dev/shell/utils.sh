no_output() {
    $1 >/dev/null 2>&1
}

with_error() {
    echo "\nKUBERNETES DEPLOYMENT FAILED WITH ERROR:"
    echo "$1"
}

check_if_exists() {
    local path=`command -v "$1"`
    if [ -n "$path" ] ;then
        return 1
    else
        return 0
    fi
}