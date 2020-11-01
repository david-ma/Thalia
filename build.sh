#!/bin/sh

# Todo:
# Echo "Done" or something on completion

SITE="${1:-example}"

echo "\033[1;31mDeveloper mode for Thalia\033[0m"
echo "Building $SITE"
echo

./node_modules/.bin/gulp build -s $SITE &
cd server
    tsc --incremental --assumeChangesOnlyAffectDirectDependencies &
cd ..
cd websites/$SITE

    if test -f "tsconfig.json"; then
        echo "tsconfig.json exists."
        tsc --incremental --assumeChangesOnlyAffectDirectDependencies &
    else
        echo "No tsconfig.json in websites/$SITE"
    fi

    if test -f "config/tsconfig.json"; then
        echo "config/tsconfig.json exists."
        cd config
            tsc --incremental --assumeChangesOnlyAffectDirectDependencies &
        cd ..
    else
        echo "No $SITE/config/tsconfig.json"
    fi

    if test -f "models/tsconfig.json"; then
        echo "models/tsconfig.json exists."
        cd models
            tsc --incremental --assumeChangesOnlyAffectDirectDependencies &
        cd ..
    else
        echo "No $SITE/models/tsconfig.json"
    fi

cd ../..
