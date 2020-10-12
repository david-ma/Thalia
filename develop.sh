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

# Run everything together
# Exit everything together
function everything()
{
    cd server
        tsc --preserveWatchOutput --watch &
    cd ..

    ./node_modules/.bin/gulp watch -t -s $SITE &
    ./node_modules/.bin/nodemon server/thalia.js $SITE $PORT
}

trap everything EXIT
