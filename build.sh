#!/bin/sh

# Todo:
# Echo "Done" or something on completion

SITE="${1:-example}"

echo "\033[1;31mDeveloper mode for Thalia\033[0m"
echo "Building $SITE"
echo

cd server
    tsc &
cd ..
cd websites/$SITE

    if test -f "webpack.config.js"; then
        echo "$SITE/webpack.config.js exists. Running Webpack."
        npm build &
    elif test -f "tsconfig.json"; then
        echo "tsconfig.json exists."
        tsc &
    else
        echo "No tsconfig.json in websites/$SITE"
    fi

    if test -f "config/tsconfig.json"; then
        echo "config/tsconfig.json exists."
        cd config
            tsc &
        cd ..
    else
        echo "No $SITE/config/tsconfig.json"
    fi

    if test -f "models/tsconfig.json"; then
        echo "models/tsconfig.json exists."
        cd models
            tsc &
        cd ..
    else
        echo "No $SITE/models/tsconfig.json"
    fi

cd ../..

./node_modules/.bin/gulp build -s $SITE

echo "Finished building $SITE"

# Run tests??
