import { defineConfig } from "drizzle-kit";

// Read docker-compose.yml for the database credentials (written as a JSON object)
import fs from 'fs'
const dockerCompose = fs.readFileSync('docker-compose.yml', 'utf8')
const dockerComposeJson = JSON.parse(dockerCompose)
const { MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_DATABASE } = dockerComposeJson.services.db.environment
const MYSQL_PORT = dockerComposeJson.services.db.ports[0].split(':')[0]
const url = `mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`

export default defineConfig({
  dialect: "mysql",
  schema: "./models/drizzle-schema.ts",
  out: "./drizzle",
  dbCredentials: { url }
});
