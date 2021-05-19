#!/bin/sh

# Todo:
# Check that port isn't being used
echo "\033[1;31mDeveloper mode for Thalia\033[0m"
echo "Running Thalia server at http://localhost:1337"
echo "gulp is running Browsersync at http://localhost:3000"
echo "tsc will recompile thalia.js on changes to server/*.ts"
echo "nodemon will restart the node server if thalia.js is changed"
echo

SITE="${1:-example}"
PORT="${2:-1337}"

echo "Developing $SITE"

./node_modules/.bin/gulp watch -t -s $SITE &
cd server
    tsc --preserveWatchOutput --watch &
cd ..

cd test
    tsc --preserveWatchOutput --watch &
cd ..

cd websites/$SITE

    if test -f "tsconfig.json"; then
        echo "$SITE/tsconfig.json exists."
        tsc --preserveWatchOutput --watch &
    else
        echo "No tsconfig.json in websites/$SITE"
    fi

    if test -f "config/tsconfig.json"; then
        echo "$SITE/config/tsconfig.json exists."
        cd config
            tsc --preserveWatchOutput --watch &
        cd ..
    else
        echo "No $SITE/config/tsconfig.json"
    fi

    if test -f "models/tsconfig.json"; then
        echo "$SITE/models/tsconfig.json exists."
        cd models
            tsc --preserveWatchOutput --watch &
        cd ..
    else
        echo "No $SITE/models/tsconfig.json"
    fi

    if test -f "test/tsconfig.json"; then
        echo "$SITE/test/tsconfig.json exists."
        cd test
            tsc --preserveWatchOutput --watch &
        cd ..
    else
        echo "No $SITE/test"
    fi
cd ../..
./node_modules/.bin/nodemon server/thalia.js $SITE $PORT
