import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./models/users.ts",
  out: "./models",

  dbCredentials: {
    url: "file:./models/sqlite.db",
  }

});


