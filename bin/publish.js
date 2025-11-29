#!/usr/bin/env node


// Write the .hbs files, from src/index.hbs to the public directory, of a given workspace

import { spawn } from 'child_process'
import path from 'path'
import browserSync from 'browser-sync'
import fs from 'fs'
import readline from 'readline'

const thaliaDirectory = process.cwd()

// Get project name from command line arguments
let projectName = process.argv[2]
const rawListOfProjects = fs
  .readdirSync(path.resolve(thaliaDirectory, 'websites'))
  .filter((file) => fs.statSync(path.resolve(thaliaDirectory, 'websites', file)).isDirectory())
  .filter((file) => file !== 'default' && file !== 'example')

const listOfProjects = ['example', ...rawListOfProjects]


if (projectName) {
  if (!listOfProjects.includes(projectName)) {
    console.error(`Project ${projectName} not found`)
    process.exit(1)
  }

  const projectRoot = path.resolve(thaliaDirectory, 'websites', projectName)
} else {
  console.error('Please specify a project name')
  console.error('Usage: node bin/publish.js <project-name>')
  process.exit(1)
}

const projectRoot = path.resolve(thaliaDirectory, 'websites', projectName)

const hbsFiles = fs.readdirSync(path.resolve(projectRoot, 'src'))
  .filter((file) => file.endsWith('.hbs'))

