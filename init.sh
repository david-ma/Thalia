#!/bin/sh

# Initialise a new Thalia project

# Get workspace name
echo "What is the name of your project?"
read PROJECT

# Add some safety, check if the folder already exists
if [ -d "websites/${PROJECT}" ]; then
  echo "Folder already exists, aborting."
  exit 1
fi

# Create folder in websites
# Create a config folder
mkdir -p websites/${PROJECT}/config

# Copy example/config/tsconfig.json
# Create config.ts
cp websites/example/config/tsconfig.json websites/${PROJECT}/config/tsconfig.json
cp websites/example/config/config.ts websites/${PROJECT}/config/config.ts

# Ask about data folder, create it, add it to config.ts & gitignore
echo "Do you want a 'data' folder? This is a folder which will be served as if it is public, but which will not be added to source control. If you use Docker, this should be mounted as a volume. (y/n)"
read DATAFOLDER
if [ "$DATAFOLDER" = "y" ]; then
  mkdir -p websites/${PROJECT}/data
  sed -i '' 's/"data": false,/"data": true,/' websites/${PROJECT}/config/config.ts
  echo "data/**" >> websites/${PROJECT}/.gitignore
fi

# Ask if a database is needed
echo "Do you want to use a database? (y/n)"
read DATABASE
if [ "$DATABASE" = "y" ]; then
  # Create a database folder
  mkdir -p websites/${PROJECT}/database

  # Create models folder
  mkdir -p websites/${PROJECT}/models

  # Copy models/tsconfig.json
  cp websites/example/models/tsconfig.json websites/${PROJECT}/models/tsconfig.json
  # Copy models/index.ts
  cp websites/example/models/index.ts websites/${PROJECT}/models/index.ts
  # Copy config/db_bootstrap.ts
  cp websites/example/config/db_bootstrap.ts websites/${PROJECT}/config/db_bootstrap.ts
fi

# Ask if docker is needed
echo "Do you want to use Docker? (y/n)"
read DOCKER
if [ "$DOCKER" = "y" ]; then
  # Copy Dockerfile
  cp websites/example/Dockerfile websites/${PROJECT}/Dockerfile

  # Copy docker-compose.yml
  cp websites/example/docker-compose.yml websites/${PROJECT}/docker-compose.yml

  # If a database is needed, add it to docker-compose.yml
  if [ "$DATABASE" = "y" ]; then
    echo "\
    aef\
    " >>websites/${PROJECT}/docker-compose.yml
  fi
fi

# Copy views folder for Handlebars
mkdir -p websites/${PROJECT}/views/partials
# cp -r websites/example/views websites/${PROJECT}/views



# Future stuff:
# SCSS compiling?
# Build script?
# 
# Initialise git? Or just remind the user to do it?
# Initialise security
# Initialise tests
