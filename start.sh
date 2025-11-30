#!/bin/sh

# Default to example-minimal (lightweight, no DB required)
# Use example-auth for full-featured example (requires Docker/DB)
PROJECT="${1:-example-minimal}"
PORT="${2}"

echo Hello user, running David Ma\'s Thalia server at localhost
echo

if [ -n "$PORT" ]; then
  bun dist/server/cli.js --project=$PROJECT --port=$PORT
else
  bun dist/server/cli.js --project=$PROJECT
fi
