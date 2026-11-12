import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";

function isDuplicateKey(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return error.code === 11000;
}

export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({ message: "Invalid request", issues: error.flatten() });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return;
  }

  if (isDuplicateKey(error)) {
    res.status(409).json({ message: "Already exists" });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Something went wrong" });
}
