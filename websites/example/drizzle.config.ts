import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./models/drizzle-schema.ts",
  out: "./drizzle",

  dbCredentials: {
    url: "mysql://not_root:password@localhost:3306/thalia",
  }
});
