#!/bin/sh

# Initialise a new Thalia project

# Take first argument as project name, or ask for it
PROJECT="${1:-}"
if [ "$PROJECT" = "" ]; then
  echo "What is the name of your project?"
  read PROJECT
fi

# Safety
if [ "$PROJECT" = "" ]; then
  echo "No project name given, aborting."
  exit 1
fi

# Check for whitespaces
if [[ "$PROJECT" =~ [[:space:]] ]]; then
  echo "Project name may not contain whitespaces, aborting."
  exit 1
fi

# Check if the folder already exists
if [ -d "websites/${PROJECT}" ]; then
  echo "Folder websites/$PROJECT already exists, are you sure you want to overwrite it? (y/n)"
  read CONTINUE
  if [ "$CONTINUE" != "y" ]; then
    echo "Aborting."
    exit 1
  fi
  echo "Overwriting folder websites/$PROJECT"
else
  echo "Creating folder websites/$PROJECT"
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
echo "The example db is PostgreSQL, run in a docker container on port 5555."
read DATABASE
if [ "$DATABASE" = "y" ]; then
  echo "Creating database folders and files, be sure to start a database server."
  echo "Making:"
  echo "  websites/${PROJECT}/models"
  echo "  websites/${PROJECT}/config/db_bootstrap.ts"
  echo "  websites/${PROJECT}/models/tsconfig.json"
  echo "  websites/${PROJECT}/models/index.ts"
  echo "  websites/${PROJECT}/models/log.ts"
  echo "  websites/${PROJECT}/models/models.d.ts"

  mkdir -p websites/${PROJECT}/models
  cp websites/example/config/db_bootstrap.ts websites/${PROJECT}/config/db_bootstrap.ts
  cp websites/example/models/tsconfig.json websites/${PROJECT}/models/tsconfig.json
  cp websites/example/models/index.ts websites/${PROJECT}/models/index.ts
  cp websites/example/models/log.ts websites/${PROJECT}/models/log.ts
  cp websites/example/models/models.d.ts websites/${PROJECT}/models/models.d.ts

  pushd websites/${PROJECT}/models
    tsc
  popd
fi

pushd websites/${PROJECT}/config
  tsc
popd

# Ask if docker is needed
echo "Do you want to use Docker? (y/n)"
read DOCKER
if [ "$DOCKER" = "y" ]; then
  # Copy Dockerfile
  cp websites/example/Dockerfile websites/${PROJECT}/Dockerfile

  # Copy docker-compose.yml
  cp websites/example/docker-compose.yml websites/${PROJECT}/docker-compose.yml

  # If a database is needed, add it to docker-compose.yml
  if [ "$DATABASE" = "n" ]; then
    head websites/example/docker-compose.yml > websites/${PROJECT}/docker-compose.yml
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
