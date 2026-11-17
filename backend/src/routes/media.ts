import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { gcsConfigured, openGcsReadStream } from "../services/storage.js";
import { uploadRoot } from "../uploads.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const mediaRouter = Router();

const namePattern = /^[0-9a-f-]{36}\.(jpe?g|png|webp|mp4|webm|mov)$/i;

function safeName(raw: string): string | null {
  const name = path.basename(raw);
  return namePattern.test(name) ? name : null;
}

mediaRouter.get(
  "/:name",
  asyncHandler(async (req, res) => {
    const name = safeName(String(req.params.name ?? ""));
    if (!name) {
      res.status(404).json({ message: "Not found" });
      return;
    }

    const localPath = path.join(uploadRoot, name);
    if (fs.existsSync(localPath)) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.sendFile(localPath);
      return;
    }

    if (!gcsConfigured()) {
      res.status(404).json({ message: "Not found" });
      return;
    }

    const stream = await openGcsReadStream(name);
    if (!stream) {
      res.status(404).json({ message: "Not found" });
      return;
    }

    const lower = name.toLowerCase();
    const type =
      lower.endsWith(".png") ? "image/png"
      : lower.endsWith(".webp") ? "image/webp"
      : lower.endsWith(".mp4") ? "video/mp4"
      : lower.endsWith(".webm") ? "video/webm"
      : lower.endsWith(".mov") ? "video/quicktime"
      : "image/jpeg";
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, max-age=86400");
    stream.on("error", () => {
      if (!res.headersSent) res.status(404).json({ message: "Not found" });
      else res.end();
    });
    stream.pipe(res);
  }),
);
