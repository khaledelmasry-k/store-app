import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "../utils/prisma.js";

export interface AuthPayload {
  id: string;
  adminId: string;
  username: string;
  email: string;
  role: string;
  tenantId?: string;
  storeId?: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AuthPayload;
      tenantId?: string | null;
      storeId?: string | null;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    req.admin = payload;
    req.tenantId = payload.role === "super_admin" ? null : (payload.tenantId || null);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.admin?.role !== "super_admin") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  // Re-validate the role against the DB so a demoted/deleted super admin
  // does not retain elevated access for the token lifetime.
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.adminId },
      select: { role: true },
    });
    if (!admin || admin.role !== "super_admin") {
      res.status(403).json({ error: "Super admin access required" });
      return;
    }
  } catch (err) {
    next(err);
    return;
  }
  next();
}
