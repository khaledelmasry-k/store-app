import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { authMiddleware } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const SVG_SIGNATURES: string[] = [
  "<svg",
  "<?xml",
  "<!DOCTYPE svg",
  "<?xml-stylesheet",
];

function looksLikeSvg(buf: Buffer): boolean {
  const head = buf.subarray(0, 512).toString("utf8").toLowerCase().trimStart();
  if (head.startsWith("\x89PNG") || head.startsWith("GIF8") || head.startsWith("RIFF") || head.startsWith("BM")) return false;
  for (const sig of SVG_SIGNATURES) {
    if (head.startsWith(sig)) return true;
  }
  if (head.includes("<svg")) return true;
  return false;
}

const router = Router();
router.use(authMiddleware);

router.post("/", (req: Request, res: Response) => {
  upload.single("image")(req, res, (err: any) => {
    if (err) {
      res.status(400).json({ error: err.message || "Upload failed" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const buf = fs.readFileSync(req.file.path);
    if (looksLikeSvg(buf)) {
      fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: "SVG files are not allowed" });
      return;
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });
});

export default router;
