#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get project name from command line arguments
const projectName = process.argv[2];

if (!projectName) {
  console.error('Please provide a project name');
  process.exit(1);
}

const projectDir = path.join(process.cwd(), projectName);
if (fs.existsSync(projectDir)) {
  console.error(`Directory ${projectName} already exists`);
  process.exit(1);
}

// Create project directory
fs.mkdirSync(projectDir);

// Copy template files
const templateDir = path.join(__dirname, '..', 'templates');
fs.readdirSync(templateDir).forEach(file => {
  const sourcePath = path.join(templateDir, file);
  const targetPath = path.join(projectDir, file);
  fs.copyFileSync(sourcePath, targetPath);
});

// Create project structure
const dirs = [
  'src',
  'views',
  'public',
  'config'
];

dirs.forEach(dir => {
  fs.mkdirSync(path.join(projectDir, dir));
});

// Initialize git repository
execSync('git init', { cwd: projectDir });

// Install dependencies
execSync('npm install', { cwd: projectDir });

console.log(`
Thalia project created successfully!

To get started:
  cd ${projectName}
  npm run dev

Available commands:
  npm start    - Start the server
  npm run dev  - Start development mode
  npm run build - Build the project
  npm run serve - Serve the built project
`); 