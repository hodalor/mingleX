import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { blockUser } from "../services/blocks.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { blockSchema } from "../validation/schemas.js";

export const blocksRouter = Router();

blocksRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = blockSchema.parse(req.body);
    await blockUser(req.userId!, input.userId);
    res.status(201).json({ blocked: true });
  }),
);
