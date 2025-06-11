#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectName = process.argv[2]
if (!projectName) {
  console.error('Please provide a project name')
  process.exit(1)
}

const projectPath = path.join(__dirname, '..', 'websites', projectName)
if (fs.existsSync(projectPath)) {
  console.error(`Project ${projectName} already exists`)
  process.exit(1)
}

// Create project structure
fs.mkdirSync(projectPath)
fs.mkdirSync(path.join(projectPath, 'config'))
fs.mkdirSync(path.join(projectPath, 'public'))
fs.mkdirSync(path.join(projectPath, 'src'))
fs.mkdirSync(path.join(projectPath, 'src', 'partials'))

// Create package.json
const packageJson = {
  name: projectName,
  version: '0.1.0',
  private: true,
  dependencies: {
    thalia: 'file:../../'
  }
}

fs.writeFileSync(
  path.join(projectPath, 'package.json'),
  JSON.stringify(packageJson, null, 2)
)

// Create tsconfig.json
const tsconfigJson = {
  extends: '../../../tsconfig.json',
  compilerOptions: {
    outDir: '../../../dist/websites/' + projectName,
    rootDir: '.',
    composite: true
  },
  include: ['**/*'],
  exclude: ['node_modules', 'dist']
}

fs.writeFileSync(
  path.join(projectPath, 'tsconfig.json'),
  JSON.stringify(tsconfigJson, null, 2)
)

// Create config.ts
const configTs = `import { users, SecurityOptions } from 'thalia'

const securityOptions: SecurityOptions = {
  websiteName: '${projectName}',
  mailFrom: 'Thalia <thalia@david-ma.net>',
  mailAuth: {
    user: 'user@example.com',
    pass: 'password',
  },
}

export const config = {
  domains: [],
  data: false,
  dist: false,
  controllers: {
    ...users(securityOptions),
  },
}
`

fs.writeFileSync(path.join(projectPath, 'config', 'config.ts'), configTs)

// Install dependencies
console.log('Installing dependencies...')
execSync('npm install', { cwd: projectPath, stdio: 'inherit' })

console.log(`Project ${projectName} created successfully!`)
console.log(`cd websites/${projectName} to get started`) 