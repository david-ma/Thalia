#!/bin/sh

export SITE="${1:-all}"
echo "Testing $SITE"

jest

