#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import browserSync from 'browser-sync';
import fs from 'fs';
import readline from 'readline';

const thaliaDirectory = process.cwd();

// Get project name from command line arguments
let projectName = process.argv[2];
if (projectName) {
  startServer(projectName);
} else {
  // No project name provided? Ask for it
  const listOfProjects = fs.readdirSync(path.resolve(thaliaDirectory, 'websites'));

  // list them in a numbered list
  console.log('Available projects:');
  console.log(listOfProjects.map((project, index) => `${index + 1}. ${project}`).join('\n'));

  prompt('Enter the number of the project: ').then((projectNumber) => {
    const projectNumberInt = parseInt(projectNumber);
    if (isNaN(projectNumberInt) || projectNumberInt < 1 || projectNumberInt > listOfProjects.length) {
      console.error('Please enter a valid project number');
      process.exit(1);
    }
    return listOfProjects[projectNumberInt - 1];
  }).then((projectName) => {
    projectName = projectName;
    if (!projectName) {
      console.error('Please specify a project name');
      console.error('Usage: node bin/develop.js <project-name>');
      process.exit(1);
    }
    console.log(`Starting server for project: ${projectName}\n`);
    startServer(projectName);
  });
}


function startServer(projectName) {
  // Set up environment for child processes
  const env = {
    ...process.env,
    PROJECT: projectName
  };

  // Get the project root directory
  const projectRoot = path.resolve(thaliaDirectory, 'websites', projectName);

  // If there is a webpack.config.js in the projectRoot, start webpack in watch mode.
  let webpack;
  if (fs.existsSync(path.resolve(projectRoot, 'webpack.config.js'))) {
    // Start webpack in watch mode
    webpack = spawn('webpack', ['--config', 'webpack.config.js', '--watch'], {
      env,
      stdio: 'inherit',
      cwd: projectRoot
    });
  } else {
    webpack = spawn('echo', ['No webpack.config.js found in project root. Skipping webpack.'], {
      env,
      stdio: 'inherit',
      cwd: projectRoot
    });
  }


  // Start nodemon for the server
  const nodemon = spawn('nodemon', ['--watch', 'server', '--watch', `websites/${projectName}`, 'dist/server/index.js', '--project', projectName], {
    env,
    stdio: 'inherit',
    cwd: projectRoot
  });

  // Handle process termination
  process.on('SIGINT', () => {
    webpack.kill();
    nodemon.kill();
    process.exit();
  });

  // Handle errors
  webpack.on('error', (err) => {
    console.error('Webpack error:', err);
    nodemon.kill();
    process.exit(1);
  });

  nodemon.on('error', (err) => {
    console.error('Nodemon error:', err);
    webpack.kill();
    process.exit(1);
  });
}

function prompt(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  let response;
  rl.setPrompt(query);
  rl.prompt();
  return new Promise((resolve, reject) => {
    rl.on('line', (userInput) => {
      response = userInput;
      rl.close();
    });
    rl.on('close', () => {
      resolve(response);
    });
  });
}
