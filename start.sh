#!/bin/sh

# Todo:
# Allow different ports
# Check that port isn't being used

SITE="${1:-default}"
PORT="${2:-1337}"

echo Hello user, running David Ma\'s nodejs server at localhost
echo
node server/thalia.js --site $SITE --port $PORT
