import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // `generate` can run without a live DB in some environments, so avoid throwing here.
    url: process.env.DATABASE_URL ?? ""
  }
});