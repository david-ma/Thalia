import { defineConfig } from "drizzle-kit";

const yaml = require('js-yaml');

// Read docker-compose.json for the database credentials
import fs from 'fs'
const dockerComposeYaml = yaml.load(fs.readFileSync('docker-compose.yml', 'utf8'))
const { MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = dockerComposeYaml.services.db.environment
// Port mapping format: "host:container" - extract host port (3346)
const MYSQL_PORT = dockerComposeYaml.services.db.ports[0].split(':')[0]
// Use localhost when connecting from host, or 'db' when connecting from within Docker network
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost'
const url = `mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`

export default defineConfig({
  dialect: "mysql",
  schema: "./models/drizzle-schema.ts",
  out: "./drizzle",
  dbCredentials: { url }
});
