#!/bin/sh

PROJECT="${1:-default}"
PORT="${2}"

echo Hello user, running David Ma\'s Thalia server at localhost
echo

if [ -n "$PORT" ]; then
  bun server/cli.ts --project=$PROJECT --port=$PORT
else
  bun server/cli.ts --project=$PROJECT
fi
