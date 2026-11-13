import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";

export function paystackConfigured(): boolean {
  return Boolean(env.paystackSecretKey);
}

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${env.paystackSecretKey}`, "Content-Type": "application/json" };
}

export async function startCheckout(userId: string): Promise<{ authorizationUrl: string; reference: string }> {
  if (!paystackConfigured()) throw new HttpError(503, "Card checkout is not set up yet");
  const user = await User.findById(userId);
  if (!user) throw new HttpError(401, "Account unavailable");
  if (!user.email) throw new HttpError(400, "Add an email before paying");
  if (user.paidAccess) throw new HttpError(409, "This account already has mingleX Plus");
  const reference = `mx_${randomBytes(8).toString("hex")}`;
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({
      email: user.email,
      amount: env.paystackAmount,
      currency: env.paystackCurrency,
      reference,
      callback_url: `${env.webOrigin}/?paystack=1`,
      metadata: { userId },
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; reference?: string };
  };
  if (!response.ok || !body.status || !body.data?.authorization_url) {
    throw new HttpError(502, body.message || "Paystack could not start the payment");
  }
  return { authorizationUrl: body.data.authorization_url, reference: body.data.reference || reference };
}

export async function grantIfPaid(reference: string, userId?: string): Promise<{ paidAccess: boolean }> {
  if (!paystackConfigured()) throw new HttpError(503, "Card checkout is not set up yet");
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env.paystackSecretKey}` },
  });
  const body = (await response.json().catch(() => ({}))) as {
    status?: boolean;
    data?: { status?: string; metadata?: { userId?: string }; amount?: number };
  };
  const paid = body.status === true && body.data?.status === "success" && Number(body.data.amount) >= env.paystackAmount;
  const owner = body.data?.metadata?.userId;
  if (!paid || !owner || (userId && owner !== userId)) return { paidAccess: false };
  await User.updateOne({ _id: owner, role: "user" }, { $set: { paidAccess: true } });
  return { paidAccess: true };
}

export function paystackSignatureMatches(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !paystackConfigured()) return false;
  const digest = createHmac("sha512", env.paystackSecretKey).update(rawBody).digest("hex");
  const left = Buffer.from(digest);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}
