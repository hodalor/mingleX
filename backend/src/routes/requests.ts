import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listRequests, openRequestThread } from "../services/requests.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { routeParam } from "../utils/params.js";

export const requestsRouter = Router();

requestsRouter.use(requireAuth);

requestsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await listRequests(req.userId!));
  }),
);

requestsRouter.post(
  "/:userId/thread",
  asyncHandler(async (req, res) => {
    const match = await openRequestThread(req.userId!, routeParam(req.params.userId));
    res.status(201).json({ match });
  }),
);
