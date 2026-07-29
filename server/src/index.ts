import express from "express";
import cors from "cors";
import helmet from "helmet";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(uploadsDir));

app.use("/api/admin", adminRoutes);
app.use("/api/admin/settings", settingsRoutes);
app.use("/api/admin/orders", ordersRoutes);
app.use("/api/admin/product", productRoutes);
app.use("/api/admin/upload", uploadRoutes);
app.use("/api/orders", storeRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export default app;
