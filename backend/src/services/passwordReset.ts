import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { ResetCode } from "../models/ResetCode.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { issueSession } from "./accounts.js";
import { mailConfigured, sendPasswordCode } from "./mail.js";

function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`reset:${email}:${code}:${env.jwtSecret}`).digest("hex");
}

export async function requestPasswordReset(email: string): Promise<{ sent: true }> {
  const normalized = email.toLowerCase();
  const recent = await ResetCode.findOne({
    email: normalized,
    createdAt: { $gt: new Date(Date.now() - 30_000) },
  });
  if (recent) {
    throw new HttpError(429, "Wait a moment before requesting another code");
  }

  const user = await User.findOne({ email: normalized });
  if (!user || user.isBanned) {
    return { sent: true };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await ResetCode.deleteMany({ email: normalized });
  await ResetCode.create({
    email: normalized,
    codeHash: hashCode(normalized, code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  if (mailConfigured()) {
    try {
      await sendPasswordCode(normalized, code);
    } catch (error) {
      await ResetCode.deleteMany({ email: normalized });
      throw error;
    }
    return { sent: true };
  }
  await ResetCode.deleteMany({ email: normalized });
  throw new HttpError(503, "Password reset email is not set up yet");
}

export async function resetPassword(email: string, code: string, password: string) {
  const normalized = email.toLowerCase();
  const record = await ResetCode.findOne({ email: normalized }).sort({ createdAt: -1 });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, "That code is incorrect or expired");
  }
  if (record.codeHash !== hashCode(normalized, code)) {
    record.attempts += 1;
    if (record.attempts >= 5) {
      await record.deleteOne();
      throw new HttpError(429, "Too many attempts. Request a new code");
    }
    await record.save();
    throw new HttpError(401, "That code is incorrect or expired");
  }

  const user = await User.findOne({ email: normalized }).select("+passwordHash");
  if (!user || user.isBanned) {
    await ResetCode.deleteMany({ email: normalized });
    throw new HttpError(401, "That code is incorrect or expired");
  }

  user.passwordHash = await bcrypt.hash(password, 12);
  const providers = user.providers ?? [];
  if (!providers.includes("email")) {
    user.providers = [...providers, "email"];
  }
  await user.save();
  await ResetCode.deleteMany({ email: normalized });
  return issueSession(user.id);
}
