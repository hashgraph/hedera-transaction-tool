#!/bin/sh
BASEDIR=$(dirname "$0")

if [ "$SKIP_NOTICE_GEN" ]; then
    exit 0
else
    NODE_GEN_PATH=$(realpath "$BASEDIR/../../notice-gen/index.js")
    echo "$NODE_GEN_PATH"
    node "$NODE_GEN_PATH"
fi
