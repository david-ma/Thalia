#!/bin/sh

# Todo:
# Allow different ports
# Check that port isn't being used

echo Hello user, running David Ma\'s nodejs server at localhost, and serving using gulp
echo
./node_modules/.bin/gulp watch -s $1 &
./node_modules/.bin/nodemon server/index.js $1 $2
