import type { NextFunction, Request, Response } from "express";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { verifyToken } from "../utils/tokens.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new HttpError(401, "Authentication required"));
    return;
  }

  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    const user = await User.findById(payload.sub).select("role isBanned");
    if (!user || user.isBanned) {
      next(new HttpError(401, "Account unavailable"));
      return;
    }
    req.userId = user.id;
    req.userRole = user.role === "admin" ? "admin" : "user";
    next();
  } catch {
    next(new HttpError(401, "Invalid token"));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.userRole !== "admin") {
    next(new HttpError(403, "Admin access required"));
    return;
  }
  next();
}
