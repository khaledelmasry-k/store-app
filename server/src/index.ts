import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import adminRoutes from "./routes/admin.js";
import ordersRoutes from "./routes/orders.js";
import productRoutes from "./routes/product.js";
import uploadRoutes from "./routes/upload.js";
import storeRoutes from "./routes/store.js";
import settingsRoutes from "./routes/settings.js";
import sellerOrdersRoutes from "./routes/seller/orders.js";
import sellerProductsRoutes from "./routes/seller/products.js";
import sellerStoresRoutes from "./routes/seller/stores.js";
import sellerStoreLinksRoutes from "./routes/seller/storeLinks.js";
import sellerDashboardRoutes from "./routes/seller/dashboard.js";
import subscriptionRoutes from "./routes/subscriptions.js";
import tenantRoutes from "./routes/tenants.js";
import authRoutes from "./routes/auth.js";
import merchantProductsRoutes from "./routes/merchantProducts.js";
import categoryRoutes from "./routes/categories.js";
import sellerRoutes from "./routes/sellers.js";
import merchantSettingsRoutes from "./routes/merchantSettings.js";
import landingPagesRoutes from "./routes/landingPages.js";
import customersRoutes from "./routes/customers.js";
import analyticsRoutes from "./routes/analytics.js";
import teamRoutes from "./routes/team.js";
import rolesRoutes from "./routes/roles.js";
import invitationsRoutes from "./routes/invitations.js";
import notificationsRoutes from "./routes/notifications.js";
import reportsRoutes from "./routes/reports.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Frontend is copied to dist/public/ by the build script
const frontendDist = path.join(__dirname, "public");
const hasFrontend = fs.existsSync(path.join(frontendDist, "index.html"));

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
const corsOrigins = config.frontendUrl.split(",").map((s) => s.trim()).filter(Boolean);
const corsOptions: any = { credentials: true };
if (corsOrigins.length === 0 || corsOrigins[0] === "*") {
  corsOptions.origin = corsOrigins[0] === "*" ? true : false;
} else {
  corsOptions.origin = corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins;
}
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const orderLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use("/api", limiter);
app.use("/api/admin/login", authLimiter);
app.use("/api/orders", orderLimiter);

app.use("/uploads", express.static(uploadsDir));

// In production, serve the built frontend
if (hasFrontend) app.use(express.static(frontendDist));

app.use("/api/admin", adminRoutes);
app.use("/api/admin/settings", settingsRoutes);
app.use("/api/admin/orders", ordersRoutes);
app.use("/api/admin/product", productRoutes);
app.use("/api/admin/upload", uploadRoutes);
app.use("/api/orders", storeRoutes);
app.use("/api/seller/orders", sellerOrdersRoutes);
app.use("/api/seller/product", sellerProductsRoutes);
app.use("/api/seller/stores", sellerStoresRoutes);
app.use("/api/seller/store-links", sellerStoreLinksRoutes);
app.use("/api/seller/dashboard", sellerDashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/merchant/products", merchantProductsRoutes);
app.use("/api/merchant/categories", categoryRoutes);
app.use("/api/merchant/sellers", sellerRoutes);
app.use("/api/admin/tenants", tenantRoutes);
app.use("/api/merchant/settings", merchantSettingsRoutes);
app.use("/api/merchant/landing-pages", landingPagesRoutes);
app.use("/api/merchant/customers", customersRoutes);
app.use("/api/merchant/analytics", analyticsRoutes);
app.use("/api/merchant/team", teamRoutes);
app.use("/api/merchant/roles", rolesRoutes);
app.use("/api/merchant/invitations", invitationsRoutes);
app.use("/api/merchant/notifications", notificationsRoutes);
app.use("/api/merchant/reports", reportsRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// SPA fallback: serve index.html for non-API routes (production only)
if (hasFrontend) {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export default app;
