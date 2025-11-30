#!/bin/sh

# Todo:
# Allow different ports
# Check that port isn't being used

# Default to example-minimal (lightweight, no DB required)
# Use example-auth for full-featured example (requires Docker/DB)
PROJECT="${1:-example-minimal}"
PORT="${2:-1337}"

echo Hello user, running David Ma\'s Thalia server at localhost
echo
bun dist/server/cli.js --project=$PROJECT --port=$PORT
