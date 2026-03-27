#!/usr/bin/env bun
/**
 * Usage:
 * From Thalia root directory, run:
 * bun bin/build-scss.ts <project-name>
 * 
 * This will build the SCSS files from /src/css/*.scss to /dist/css/*.css
 */


import fs from 'fs'
import path from 'path'
import * as sass from 'sass'

const projectName = process.argv[2]

if (!projectName) {
  console.error('Usage: bun bin/build-scss.ts <project-name>')
  process.exit(1)
}

const projectRoot = path.join(process.cwd(), 'websites', projectName)
const srcDir = path.join(projectRoot, 'src')
const distDir = path.join(projectRoot, 'dist')
if (!fs.existsSync(srcDir)) {
  console.error(`No src directory found in ${projectName}`)
  process.exit(1)
}

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true })
}

// Find all .scss files recursively
function findScssFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findScssFiles(fullPath, baseDir))
    } else if (entry.name.endsWith('.scss') && !entry.name.startsWith('_')) {
      // Skip partials (files starting with _)
      files.push(fullPath)
    }
  }

  return files
}

const scssFiles = findScssFiles(srcDir)

console.log(`Building SCSS for ${projectName}...`)
let compiled = 0
let errors = 0

for (const scssFile of scssFiles) {
  try {
    const relativePath = path.relative(srcDir, scssFile)
    const cssPath = path.join(distDir, relativePath.replace('.scss', '.css'))
    
    // Create directory structure in public
    const cssDir = path.dirname(cssPath)
    if (!fs.existsSync(cssDir)) {
      fs.mkdirSync(cssDir, { recursive: true })
    }

    // Compile SCSS
    const result = sass.compile(scssFile)
    fs.writeFileSync(cssPath, result.css)
    
    console.log(`  ✓ ${relativePath} → ${path.relative(projectRoot, cssPath)}`)
    compiled++
  } catch (error) {
    console.error(`  ✗ ${path.relative(srcDir, scssFile)}: ${error}`)
    errors++
  }
}

console.log(`\nCompiled ${compiled} file(s), ${errors} error(s)`)

if (errors > 0) {
  process.exit(1)
}
