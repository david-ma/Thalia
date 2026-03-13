import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Drizzle-kit loads this file as CJS, where import.meta is not available. Use __dirname when present (CJS), else ESM.
const projectRoot =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

function getDbUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const dockerPath = path.join(projectRoot, "docker-compose.yml");
  if (!fs.existsSync(dockerPath)) {
    throw new Error(
      `No docker-compose.yml at ${dockerPath} and DATABASE_URL not set. ` +
        "From Thalia root run: cd websites/example-auth && docker compose up -d, or set DATABASE_URL."
    );
  }
  const yaml = require("js-yaml");
  const dockerComposeYaml = yaml.load(fs.readFileSync(dockerPath, "utf8"));
  const db = dockerComposeYaml?.services?.db;
  if (!db?.environment) {
    throw new Error(
      `docker-compose.yml at ${dockerPath} must define services.db.environment (MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD).`
    );
  }
  const { MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = db.environment;
  const portMapping = db.ports?.[0];
  const MYSQL_PORT = portMapping ? String(portMapping).split(":")[0] : "3306";
  const MYSQL_HOST = process.env.MYSQL_HOST || "localhost";
  return `mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`;
}

const url = getDbUrl();

export default defineConfig({
  dialect: "mysql",
  schema: "./models/drizzle-schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
