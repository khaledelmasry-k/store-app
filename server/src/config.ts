import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const jwtSecret = process.env.JWT_SECRET;
const nodeEnv = process.env.NODE_ENV || "development";
const isDev = nodeEnv === "development";
const WEAK_SECRETS = ["change-me-in-production", "dev-only-insecure-secret", "store-jwt-secret-change-in-production"];
if (!jwtSecret || (WEAK_SECRETS.includes(jwtSecret) && !isDev)) {
  // Fail fast: never run with a missing or publicly-known secret outside local dev.
  throw new Error("JWT_SECRET must be set to a strong, unique secret");
}

const DEFAULT_ORIGINS = "http://localhost:5173,http://localhost:3000,https://mk-store-app.web.app";

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  jwtSecret: jwtSecret || "dev-only-insecure-secret",
  databaseUrl: process.env.DATABASE_URL || "",
  frontendUrl: process.env.FRONTEND_URL || DEFAULT_ORIGINS,
};
