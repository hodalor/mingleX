import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { swipeSchema } from "../validation/schemas.js";
import { recordSwipe, rewindLastSwipe } from "../services/swipes.js";

export const swipesRouter = Router();

swipesRouter.post(
  "/rewind",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await rewindLastSwipe(req.userId!));
  }),
);

swipesRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = swipeSchema.parse(req.body);
    const result = await recordSwipe(req.userId!, input.toUserId, input.direction);
    res.status(201).json(result);
  }),
);
