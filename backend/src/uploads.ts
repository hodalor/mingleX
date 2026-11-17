import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { deletePublicPhoto, gcsConfigured, uploadPublicPhoto } from "./services/storage.js";
import { HttpError } from "./utils/httpError.js";

export const uploadRoot = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadRoot, { recursive: true });

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!imageTypes.has(file.mimetype) && !videoTypes.has(file.mimetype)) {
      callback(new Error("Use a JPEG, PNG, or WEBP photo, or an MP4, WEBM, or MOV video"));
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
      next(new HttpError(400, "Photos must be 5 MB or smaller and videos 25 MB or smaller"));
      return;
    }
    const message = error instanceof Error ? error.message : "That photo could not be uploaded";
    next(new HttpError(400, message));
  });
}

export function isVideoFile(file: Express.Multer.File): boolean {
  return file.mimetype.startsWith("video/");
}

export async function publishPhoto(file: Express.Multer.File): Promise<string> {
  if (!isVideoFile(file) && file.size > 5 * 1024 * 1024) {
    throw new HttpError(400, "Photos must be 5 MB or smaller");
  }
  const extension = path.extname(file.originalname).toLowerCase();
  const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".mp4", ".webm", ".mov"]);
  const fallback = isVideoFile(file) ? ".mp4" : ".jpg";
  const safe = allowed.has(extension) ? extension : fallback;
  const name = `${randomUUID()}${safe}`;
  if (gcsConfigured()) {
    try {
      return await uploadPublicPhoto(name, file.buffer, file.mimetype);
    } catch {
      throw new HttpError(502, "We couldn't store that file. Try again in a moment.");
    }
  }
  await fs.promises.writeFile(path.join(uploadRoot, name), file.buffer);
  return `/media/${name}`;
}

export function removeStoredPhoto(url: string): void {
  if (url.startsWith("/uploads/") || url.startsWith("/media/")) {
    const filename = path.basename(url);
    const fullPath = path.resolve(uploadRoot, filename);
    if (!fullPath.startsWith(uploadRoot)) return;
    fs.rmSync(fullPath, { force: true });
  }
  void deletePublicPhoto(url).catch(() => {
    console.error("Stored photo could not be removed");
  });
}
