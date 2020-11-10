#!/bin/sh

export SITE="${1:-all}"
echo "Testing $SITE"

export HEADLESS=false
export SLOWMO=true

jest --logHeapUsage --detectOpenHandles

