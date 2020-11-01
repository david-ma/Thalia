#!/bin/sh

echo "\033[1;31mWatch mode for Thalia\033[0m"
echo "gulp is running Browsersync at http://localhost:3000"
echo "tsc will recompile thalia.js on changes to server/*.ts"
echo

SITE=$1

SITE="${1:-example}"

echo "Watching $SITE"

cd server
    tsc --incremental --preserveWatchOutput --watch --assumeChangesOnlyAffectDirectDependencies &
cd ..
cd websites/$SITE

    if test -f "tsconfig.json"; then
        echo "tsconfig.json exists."
        tsc --incremental --preserveWatchOutput --watch --assumeChangesOnlyAffectDirectDependencies &
    else
        echo "No tsconfig.json in websites/$SITE"
    fi

    if test -f "config/tsconfig.json"; then
        echo "config/tsconfig.json exists."
        cd config
            tsc --incremental --preserveWatchOutput --watch --assumeChangesOnlyAffectDirectDependencies &
        cd ..
    else
        echo "No $SITE/config/tsconfig.json"
    fi

    if test -f "models/tsconfig.json"; then
        echo "models/tsconfig.json exists."
        cd models
            tsc --incremental --preserveWatchOutput --watch --assumeChangesOnlyAffectDirectDependencies &
        cd ..
    else
        echo "No $SITE/models/tsconfig.json"
    fi

cd ../..

./node_modules/.bin/gulp watch -t -s $SITE
