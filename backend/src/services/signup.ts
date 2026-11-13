import { createHash, randomInt } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { SignupCode } from "../models/SignupCode.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { phoneFromFirebaseToken } from "./firebase.js";
import { mailConfigured, sendSignupCode } from "./mail.js";

function hashCode(channel: string, target: string, code: string): string {
  return createHash("sha256").update(`signup:${channel}:${target}:${code}:${env.jwtSecret}`).digest("hex");
}

export function signSignupProof(channel: "email" | "phone", target: string): string {
  return jwt.sign({ purpose: "signup", channel, target }, env.jwtSecret, { expiresIn: "15m" });
}

export function assertSignupProof(token: string, channel: "email" | "phone", target: string): void {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    const expected = channel === "email" ? target.toLowerCase() : target;
    if (decoded.purpose !== "signup" || decoded.channel !== channel || decoded.target !== expected) {
      throw new Error("mismatch");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "Confirm the code before choosing a password");
  }
}

async function issueEmailCode(email: string): Promise<void> {
  const normalized = email.toLowerCase();
  const recent = await SignupCode.findOne({
    channel: "email",
    target: normalized,
    createdAt: { $gt: new Date(Date.now() - 30_000) },
  });
  if (recent) throw new HttpError(429, "Wait a moment before requesting another code");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await SignupCode.deleteMany({ channel: "email", target: normalized });
  await SignupCode.create({
    channel: "email",
    target: normalized,
    codeHash: hashCode("email", normalized, code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  if (mailConfigured()) {
    try {
      await sendSignupCode(normalized, code);
    } catch (error) {
      await SignupCode.deleteMany({ channel: "email", target: normalized });
      throw error;
    }
    return;
  }
  await SignupCode.deleteMany({ channel: "email", target: normalized });
  throw new HttpError(503, "Email verification is not set up yet");
}

export async function sendSignupCodes(email: string, phone?: string): Promise<{ sent: true }> {
  const normalized = email.toLowerCase();
  const existing = await User.findOne({ email: normalized });
  if (existing) throw new HttpError(409, "An account with this email already exists");
  if (phone) {
    const taken = await User.findOne({ phone });
    if (taken) throw new HttpError(409, "That number is already on another account");
  }
  await issueEmailCode(normalized);
  return { sent: true };
}

export async function confirmSignupCodes(input: {
  email: string;
  emailCode: string;
  phone?: string;
  firebaseIdToken?: string;
}): Promise<{ emailProof: string; phoneProof?: string }> {
  const normalized = input.email.toLowerCase();
  const row = await SignupCode.findOne({ channel: "email", target: normalized });
  if (!row || row.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, "That code has expired. Send a new one");
  }
  if (row.attempts >= 5) throw new HttpError(401, "Too many tries. Send a new code");
  if (row.codeHash !== hashCode("email", normalized, input.emailCode)) {
    row.attempts += 1;
    await row.save();
    throw new HttpError(401, "That code is not right");
  }
  let phoneProof: string | undefined;
  if (input.phone) {
    if (!input.firebaseIdToken) throw new HttpError(400, "Confirm the code sent to the phone");
    const verified = await phoneFromFirebaseToken(input.firebaseIdToken);
    if (verified !== input.phone) throw new HttpError(401, "That phone sign-in could not be confirmed");
    phoneProof = signSignupProof("phone", verified);
  }
  await SignupCode.deleteMany({ channel: "email", target: normalized });
  return { emailProof: signSignupProof("email", normalized), phoneProof };
}
