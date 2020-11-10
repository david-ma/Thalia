#!/bin/sh

echo "\033[1;31mWatch mode for Thalia\033[0m"
echo "gulp is running Browsersync at http://localhost:3000"
echo "tsc will recompile thalia.js on changes to server/*.ts"
echo

SITE=$1

SITE="${1:-example}"

echo "Watching $SITE"

cd server
    tsc --preserveWatchOutput --watch &
cd ..

cd test
    tsc --preserveWatchOutput --watch &
cd ..

cd websites/$SITE

    if test -f "tsconfig.json"; then
        echo "tsconfig.json exists."
        tsc --preserveWatchOutput --watch &
    else
        echo "No tsconfig.json in websites/$SITE"
    fi

    if test -f "config/tsconfig.json"; then
        echo "config/tsconfig.json exists."
        cd config
            tsc --preserveWatchOutput --watch &
        cd ..
    else
        echo "No $SITE/config/tsconfig.json"
    fi

    if test -f "models/tsconfig.json"; then
        echo "models/tsconfig.json exists."
        cd models
            tsc --preserveWatchOutput --watch &
        cd ..
    else
        echo "No $SITE/models/tsconfig.json"
    fi

cd ../..

./node_modules/.bin/gulp watch -t -s $SITE
