import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { grantIfPaid, paystackConfigured, paystackSignatureMatches, startCheckout } from "../services/paystack.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const billingRouter = Router();

billingRouter.get(
  "/config",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({
      paystack: paystackConfigured(),
      publicKey: env.paystackPublicKey,
      currency: env.paystackCurrency,
      amount: env.paystackAmount,
    });
  }),
);

billingRouter.post(
  "/checkout",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await startCheckout(req.userId!));
  }),
);

billingRouter.get(
  "/verify",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reference = z.object({ reference: z.string().trim().min(6).max(100) }).parse(req.query).reference;
    res.json(await grantIfPaid(reference, req.userId));
  }),
);

billingRouter.post(
  "/paystack/webhook",
  asyncHandler(async (req, res) => {
    const raw = (req as { rawBody?: Buffer }).rawBody;
    const signature = req.get("x-paystack-signature");
    if (!raw || !paystackSignatureMatches(raw, signature)) {
      res.status(401).json({ message: "Invalid Paystack signature" });
      return;
    }
    const body = req.body as { event?: string; data?: { reference?: string } };
    if (body.event === "charge.success" && body.data?.reference) {
      await grantIfPaid(body.data.reference);
    }
    res.json({ received: true });
  }),
);
