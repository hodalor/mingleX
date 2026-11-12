import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export function mailConfigured(): boolean {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.mailFrom);
}

export async function sendPasswordCode(to: string, code: string): Promise<void> {
  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
  try {
    await transport.sendMail({
      from: env.mailFrom,
      to,
      subject: "Your mingleX password code",
      text: `Your mingleX password code is ${code}. It expires in 10 minutes. If you did not ask for this, you can ignore the message.`,
    });
  } catch {
    throw new HttpError(502, "We couldn't send that email. Try again in a moment");
  }
}
