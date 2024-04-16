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
STANDALONE="${3:-false}"
export NODE_OPTIONS='--max-http-header-size=65536'

if test -d "websites/$SITE"; then
    echo "Developing $SITE"
else
    echo "No websites/$SITE"
    exit 1
fi


# Run healthcheck.sh
if test -f "websites/$SITE/config/healthcheck.sh"; then
    echo "Running healthcheck.sh for $SITE"

    if bash websites/$SITE/config/healthcheck.sh; then
        echo "Healthcheck passed for $SITE"
    else
        echo "Healthcheck failed for $SITE"
        exit 1
    fi
fi


./node_modules/.bin/gulp develop -t -s $SITE &
cd server
    tsc --preserveWatchOutput --watch &
    tsc -p helpers.tsconfig.json --preserveWatchOutput --watch &
cd ..

cd websites/$SITE

    if test -f "webpack.config.js"; then
        echo "$SITE/webpack.config.js exists. Running Webpack."
        pnpm develop:webpack &
    elif test -f "tsconfig.json"; then
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
cd ../..


if [ "$STANDALONE" = true ] ; then
    echo "Running standalone nodemon thalia"
    cd websites/$SITE
    pnpm nodemon thalia
else
    ./node_modules/.bin/nodemon $SITE $PORT
fi


# Changed because we added this to package.json:
#   "nodemonConfig": {
#     "exec": "node server/thalia.js",
# }
