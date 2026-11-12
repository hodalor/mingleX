import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { HttpError } from "./utils/httpError.js";

export const uploadRoot = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadRoot, { recursive: true });

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadRoot),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const safe = [".jpg", ".jpeg", ".png", ".webp"].includes(extension) ? extension : ".jpg";
      callback(null, `${randomUUID()}${safe}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      callback(new Error("Use a JPEG, PNG, or WEBP photo"));
      return;
    }
    callback(null, true);
  },
});

export function acceptPhoto(req: Request, res: Response, next: NextFunction): void {
  upload.single("photo")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(400, "Photos must be 5 MB or smaller"));
      return;
    }
    const message = error instanceof Error ? error.message : "That photo could not be uploaded";
    next(new HttpError(400, message));
  });
}

export function removeStoredPhoto(url: string): void {
  if (!url.startsWith("/uploads/")) return;
  const filename = path.basename(url);
  const fullPath = path.resolve(uploadRoot, filename);
  if (!fullPath.startsWith(uploadRoot)) return;
  fs.rmSync(fullPath, { force: true });
}
