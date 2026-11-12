import { createHash, randomInt } from "node:crypto";
import { env } from "../config/env.js";
import { PhoneCode } from "../models/PhoneCode.js";
import { HttpError } from "../utils/httpError.js";

function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}:${env.jwtSecret}`).digest("hex");
}

function smsConfigured(): boolean {
  return Boolean(env.twilioAccountSid && env.twilioAuthToken && env.twilioFromNumber);
}

async function sendSms(phone: string, code: string): Promise<void> {
  const body = new URLSearchParams({
    To: phone,
    From: env.twilioFromNumber,
    Body: `Your mingleX code is ${code}`,
  });
  const credentials = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  if (!response.ok) {
    throw new HttpError(502, "We couldn't send that code. Try again in a moment");
  }
}

export async function sendPhoneCode(phone: string): Promise<{ devCode?: string }> {
  const recent = await PhoneCode.findOne({
    phone,
    createdAt: { $gt: new Date(Date.now() - 30_000) },
  });
  if (recent) {
    throw new HttpError(429, "Wait a moment before requesting another code");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await PhoneCode.deleteMany({ phone });
  await PhoneCode.create({
    phone,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  if (smsConfigured()) {
    await sendSms(phone, code);
    return {};
  }
  if (env.nodeEnv === "production") {
    await PhoneCode.deleteMany({ phone });
    throw new HttpError(503, "Phone sign-in is not configured");
  }
  return { devCode: code };
}

export async function verifyPhoneCode(phone: string, code: string): Promise<void> {
  const record = await PhoneCode.findOne({ phone }).sort({ createdAt: -1 });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, "That code is incorrect or expired");
  }
  if (record.codeHash !== hashCode(phone, code)) {
    record.attempts += 1;
    if (record.attempts >= 5) {
      await record.deleteOne();
      throw new HttpError(429, "Too many attempts. Request a new code");
    }
    await record.save();
    throw new HttpError(401, "That code is incorrect or expired");
  }
  await PhoneCode.deleteMany({ phone });
}
