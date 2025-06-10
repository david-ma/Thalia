#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get project name from command line arguments
const projectName = process.argv[2];

if (!projectName) {
  console.error('Please provide a project name');
  console.error('Usage: node create-project.js <project-name>');
  process.exit(1);
}

const projectPath = path.join(__dirname, '..', 'websites', projectName);

// Check if project already exists
if (fs.existsSync(projectPath)) {
  console.error(`Project "${projectName}" already exists`);
  process.exit(1);
}

// Create project directory
fs.mkdirSync(projectPath, { recursive: true });

// Copy example project
const examplePath = path.join(__dirname, '..', 'websites', 'example');
execSync(`cp -r ${examplePath}/* ${projectPath}`);

// Update package.json
const packageJsonPath = path.join(projectPath, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.name = projectName;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

console.log(`Project "${projectName}" created successfully!`);
console.log(`\nTo start development:`);
console.log(`1. cd websites/${projectName}`);
console.log(`2. npm install`);
console.log(`3. npm run dev`); 