#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Get project name from command line arguments
const projectName = process.argv[3] || 'example';
if (!projectName) {
  console.error('Please specify a project name');
  console.error('Usage: node bin/develop.js <project-name>');
  process.exit(1);
}

// Set up environment for child processes
const env = {
  ...process.env,
  PROJECT: projectName
};

// Get the project root directory
const projectRoot = path.resolve(__dirname, '..');

// Start webpack in watch mode
const webpack = spawn('webpack', ['--config', 'webpack.dev.js', '--watch'], {
  env,
  stdio: 'inherit',
  cwd: projectRoot
});

// Start nodemon for the server
const nodemon = spawn('nodemon', ['--watch', 'server', '--watch', `websites/${projectName}`, 'bin/thalia.js', '--project', projectName], {
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