#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get project name from command line arguments
const projectName = process.argv[2];

// Get all project directories
function getProjects() {
  const websitesDir = path.join(__dirname, '..', 'websites');
  if (!fs.existsSync(websitesDir)) {
    console.error('No websites directory found');
    process.exit(1);
  }

  return fs.readdirSync(websitesDir)
    .filter(file => {
      const fullPath = path.join(websitesDir, file);
      return fs.statSync(fullPath).isDirectory() && 
             fs.existsSync(path.join(fullPath, 'src'));
    });
}

// Build a single project
function buildProject(project) {
  console.log(`\nBuilding project: ${project}`);
  try {
    execSync(`PROJECT=${project} webpack --config webpack.prod.js`, {
      stdio: 'inherit'
    });
    console.log(`✅ Successfully built ${project}`);
  } catch (error) {
    console.error(`❌ Failed to build ${project}`);
    process.exit(1);
  }
}

// Main build process
if (projectName) {
  // Build single project
  const projectPath = path.join(__dirname, '..', 'websites', projectName);
  if (!fs.existsSync(projectPath)) {
    console.error(`Project "${projectName}" not found`);
    process.exit(1);
  }
  buildProject(projectName);
} else {
  // Build all projects
  const projects = getProjects();
  if (projects.length === 0) {
    console.error('No projects found in websites directory');
    process.exit(1);
  }

  console.log('Building all projects...');
  projects.forEach(buildProject);
  console.log('\n✨ All projects built successfully!');
} 