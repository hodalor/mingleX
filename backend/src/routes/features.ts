import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { accessMap, memberHasPaidAccess, paymentFlags } from "../services/billing.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const featuresRouter = Router();

featuresRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [requiresPayment, access, paidAccess] = await Promise.all([
      paymentFlags(),
      accessMap(req.userId!),
      memberHasPaidAccess(req.userId!),
    ]);
    res.json({ requiresPayment, access, paidAccess, showPlusNote: requiresPayment.hideAds && !paidAccess });
  }),
);
