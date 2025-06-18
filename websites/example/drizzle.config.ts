import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./models/drizzle-schema.ts",
  out: "./drizzle",

  dbCredentials: {
    url: "file:./models/sqlite.db",
  }
});
