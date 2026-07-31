import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === "change-me-in-production") {
  // Fail fast in production; keep a random dev secret otherwise so dev never runs with a weak secret.
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to a strong secret in production");
  }
}

export const config = {
  port: parseInt(process.env.PORT || "8080", 10),
  jwtSecret: jwtSecret || "dev-only-insecure-secret",
  databaseUrl: process.env.DATABASE_URL || "",
  frontendUrl: process.env.FRONTEND_URL || "*",
};
