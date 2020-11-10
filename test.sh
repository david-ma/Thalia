#!/bin/sh

echo "Testing $SITE"

export SITE="${1:-all}"
# export HEADLESS=false
# export SLOWMO=true

current_time=$(date "+%Y.%m.%d-%H.%M.%S")

jest --logHeapUsage --noStackTrace --json --outputFile=./tmp/jest_$current_time.json

