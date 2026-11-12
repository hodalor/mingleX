import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

const jwtSecret = required("JWT_SECRET");

if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}

function optional(name: string): string {
  return process.env[name]?.trim() ?? "";
}

const appleClientIds = optional("APPLE_CLIENT_ID")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: required("MONGODB_URI"),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  webOrigin: process.env.CLIENT_WEB_ORIGIN ?? "http://localhost:5173",
  adminOrigin: process.env.CLIENT_ADMIN_ORIGIN ?? "http://localhost:5174",
  googleClientId: optional("GOOGLE_CLIENT_ID"),
  appleClientIds,
  twilioAccountSid: optional("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: optional("TWILIO_AUTH_TOKEN"),
  twilioFromNumber: optional("TWILIO_FROM_NUMBER"),
  smtpHost: optional("SMTP_HOST"),
  smtpPort: Number(process.env.SMTP_PORT) > 0 ? Number(process.env.SMTP_PORT) : 587,
  smtpUser: optional("SMTP_USER"),
  smtpPass: optional("SMTP_PASS"),
  mailFrom: optional("MAIL_FROM"),
};
