#!/bin/sh

# Todo:
# Allow different ports
# Check that port isn't being used
echo "\033[1;31mDeveloper mode for Thalia\033[0m"
echo "Running Thalia server at http://localhost:1337"
echo "gulp is running Browsersync at http://localhost:3000"
echo "tsc will recompile thalia.js on changes to server/*.ts"
echo "nodemon will restart the node server if thalia.js is changed"
echo

SITE=$1
PORT=$2

./node_modules/.bin/gulp watch -t -s $SITE &
cd server
    tsc --incremental --preserveWatchOutput --watch --assumeChangesOnlyAffectDirectDependencies &
cd ..
./node_modules/.bin/nodemon --delay 2 server/thalia.js $SITE $PORT
