#!/bin/sh

export SITE="${1:-all}"
export PAGE="${2}"

# export HEADLESS=false
# export SLOWMO=true

echo "Running test.sh on $SITE $PAGE"

current_time=$(date "+%Y.%m.%d-%H.%M.%S")

yarn jest --logHeapUsage --noStackTrace --json --outputFile=./tmp/jest_$current_time.json

