#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import browserSync from 'browser-sync';
import fs from 'fs';
import readline from 'readline';

const thaliaDirectory = process.cwd();

// Get project name from command line arguments
let projectName = process.argv[2];
const listOfProjects = fs.readdirSync(path.resolve(thaliaDirectory, 'websites'));


if (projectName) {
  if (!listOfProjects.includes(projectName)) {
    console.error(`Project ${projectName} not found`);
    process.exit(1);
  }
  startServer(projectName);
} else {
  // No project name provided? Ask for it

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

  // Start tsc for the server
  const tsc = spawn('tsc', ['--watch'], {
    env,
    stdio: 'inherit',
    cwd: thaliaDirectory
  });

  // Start nodemon for the server
  const nodemon = spawn('nodemon', [
    '--watch', 'dist',
    '--watch', `websites/${projectName}`,
    'dist/server/index.js'], {
    env: {
      ...env,
      PROJECT: projectName,
      PORT: 3000,
      WEBSITE: projectName
    },
    stdio: 'inherit',
    cwd: thaliaDirectory
  });

  // start tsc in project config
  const projectTsc = spawn('tsc', ['--watch'], {
    env,
    stdio: 'inherit',
    cwd: `${projectRoot}/config`
  });

  const processes = [tsc, nodemon, projectTsc];
  const bs = browserSync.create();

  // set timeout for 500ms
  setTimeout(() => {
    bs.init({
      proxy: `http://localhost:3000`,
      port: 3001,
      open: false,
      notify: false,
      reloadDelay: 1000,
      files: [
        `${thaliaDirectory}/dist/**/*`,
        `${projectRoot}/**/*`,
      ]
    });
  }, 500);

  // If the user presses Ctrl+C, kill all processes
  process.on('SIGINT', () => {
    console.log('SIGINT received, exiting');

    bs.cleanup();
    bs.exit();
    processes.forEach(process => process.kill('SIGINT'));
    process.exit(0);
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
