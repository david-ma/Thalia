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

// Check for file conflicts in a project
function checkFileConflicts(project) {
  console.log(`Checking for file conflicts in ${project}`);
  const srcDir = path.join(__dirname, '..', 'websites', project, 'src');
  const exampleSrcDir = path.join(__dirname, '..', 'websites', 'example', 'src');
  
  // Skip if neither directory exists
  if (!fs.existsSync(srcDir) && !fs.existsSync(exampleSrcDir)) return;

  // Helper function to check conflicts within a directory
  function checkDirectoryConflicts(dir, dirName) {
    if (!fs.existsSync(dir)) return;

    const fileMap = new Map(); // Map of base names to their full paths and extensions
    const htmlFiles = new Set(); // Track HTML template files

    const files = fs.readdirSync(dir, { recursive: true });
    files.forEach(file => {
      const ext = path.extname(file);
      const baseName = path.basename(file, ext);
      const fullPath = path.join(dir, file);

      // Skip directories
      if (fs.statSync(fullPath).isDirectory()) return;

      // Track HTML template files
      if (ext === '.html' || ext === '.hbs') {
        htmlFiles.add(baseName);
      }

      // Check for conflicts between different file types
      if (fileMap.has(baseName)) {
        const existing = fileMap.get(baseName);
        const conflictingTypes = {
          '.html': '.hbs',
          '.hbs': '.html',
          '.js': '.ts',
          '.ts': '.js',
          '.css': '.scss',
          '.scss': '.css'
        };

        if (conflictingTypes[ext] === existing.ext) {
          const relativePath1 = path.relative(process.cwd(), fullPath);
          const relativePath2 = path.relative(process.cwd(), existing.path);
          throw new Error(
            `File type conflict detected in ${dirName}:\n` +
            `  - ${relativePath1}\n` +
            `  - ${relativePath2}\n` +
            `These files would compile to the same target but have different source types.\n` +
            `Please choose one file type and remove the other.\n` +
            `Note: Project files with the same name and extension will automatically override example files.`
          );
        }
      }

      fileMap.set(baseName, { path: fullPath, ext });
    });

    // Check for multiple HTML templates that would output to the same file
    if (htmlFiles.size > 1) {
      const conflictingFiles = Array.from(htmlFiles).map(name => {
        const htmlPath = path.join(dir, `${name}.html`);
        const hbsPath = path.join(dir, `${name}.hbs`);
        return [
          fs.existsSync(htmlPath) ? path.relative(process.cwd(), htmlPath) : null,
          fs.existsSync(hbsPath) ? path.relative(process.cwd(), hbsPath) : null
        ].filter(Boolean);
      }).filter(files => files.length > 1);

      if (conflictingFiles.length > 0) {
        throw new Error(
          `Multiple HTML templates would compile to the same output file in ${dirName}:\n` +
          conflictingFiles.map(files => 
            `  - ${files.join('\n  - ')}\n` +
            `    These would all compile to: ${path.basename(files[0], path.extname(files[0]))}.html\n` +
            `    Please choose one template type (.html or .hbs) and remove the other.\n` +
            `    Note: Project files with the same name and extension will automatically override example files.`
          ).join('\n')
        );
      }
    }
  }

  // Check conflicts in both directories independently
  checkDirectoryConflicts(exampleSrcDir, 'example');
  checkDirectoryConflicts(srcDir, project);
}

// Format error message for better readability
function formatError(error) {
  const message = error.message || error;
  
  // Check if it's a file conflict error
  if (message.includes('File conflict detected') || message.includes('Multiple HTML templates')) {
    return `\n🚫 ${message}\n\nTo resolve this conflict:\n` +
           `1. Choose which file you want to keep\n` +
           `2. Delete or rename the conflicting file\n` +
           `3. Run the build command again\n`;
  }
  
  // Check if it's a webpack error
  if (message.includes('webpack')) {
    return `\n🚫 Build Error:\n${message}\n`;
  }
  
  // Default error formatting
  return `\n🚫 Error: ${message}\n`;
}

// Build a single project
function buildProject(project) {
  console.log(`\nBuilding project: ${project}`);
  try {
    // Check for conflicts before running webpack
    checkFileConflicts(project);
    
    execSync(`PROJECT=${project} webpack --config webpack.prod.js`, {
      stdio: 'inherit'
    });
    console.log(`✅ Successfully built ${project}`);
  } catch (error) {
    console.error(formatError(error));
    console.error(`❌ Failed to build ${project}`);
    process.exit(1);
  }
}

// Main build process
if (projectName) {
  // Build single project
  const projectPath = path.join(__dirname, '..', 'websites', projectName);
  if (!fs.existsSync(projectPath)) {
    console.error(`\n🚫 Project "${projectName}" not found in websites directory`);
    console.error('\nAvailable projects:');
    const projects = getProjects();
    if (projects.length > 0) {
      projects.forEach(p => console.error(`  - ${p}`));
    } else {
      console.error('  No projects found');
    }
    process.exit(1);
  }
  buildProject(projectName);
} else {
  // Build all projects
  const projects = getProjects();
  if (projects.length === 0) {
    console.error('\n🚫 No projects found in websites directory');
    console.error('\nMake sure you have at least one project with a src directory in the websites folder');
    process.exit(1);
  }

  console.log('Building all projects...');
  projects.forEach(buildProject);
  console.log('\n✨ All projects built successfully!');
} 