import { Router } from "express";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { issueSession, loginWithPhone, loginWithProvider } from "../services/accounts.js";
import { mailConfigured } from "../services/mail.js";
import { requestPasswordReset, resetPassword } from "../services/passwordReset.js";
import { sendPhoneCode, verifyPhoneCode } from "../services/phone.js";
import { verifyAppleToken, verifyGoogleToken } from "../services/providers.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isAtLeast18, parseBirthDate } from "../utils/age.js";
import { HttpError } from "../utils/httpError.js";
import { routeParam } from "../utils/params.js";
import {
  appleAuthSchema,
  devProviderSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  loginSchema,
  phoneSchema,
  resetPasswordSchema,
  phoneVerifySchema,
  registerSchema,
} from "../validation/schemas.js";

export const authRouter = Router();

authRouter.get("/providers", (_req, res) => {
  const sms = Boolean(env.twilioAccountSid && env.twilioAuthToken && env.twilioFromNumber);
  res.json({
    google: Boolean(env.googleClientId),
    apple: env.appleClientIds.length > 0,
    googleClientId: env.googleClientId || null,
    appleClientId: env.appleClientIds[0] ?? null,
    sms,
    email: mailConfigured(),
    devPreview: env.nodeEnv !== "production",
  });
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    let birthDate: Date;
    try {
      birthDate = parseBirthDate(input.birthDate);
    } catch {
      throw new HttpError(400, "Birth date must be a real date in YYYY-MM-DD form");
    }
    if (birthDate.getTime() > Date.now() || !isAtLeast18(birthDate)) {
      throw new HttpError(403, "mingleX is for adults 18 and older");
    }

    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw new HttpError(409, "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await User.create({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      birthDate,
      gender: input.gender,
      interestedIn: input.interestedIn ?? ["woman", "man", "nonbinary"],
      providers: ["email"],
    });
    res.status(201).json(await issueSession(user.id));
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await User.findOne({ email: input.email.toLowerCase() }).select("+passwordHash");
    if (!user) {
      throw new HttpError(401, "Email or password is incorrect");
    }
    if (user.isBanned) {
      throw new HttpError(403, "This account is banned");
    }
    const providers = user.providers ?? [];
    if (!user.passwordHash) {
      const other = providers.filter((provider) => provider !== "email");
      const label = other.length > 0 ? other.join(" or ") : "a social account";
      throw new HttpError(401, `This email uses ${label} sign-in`);
    }
    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) {
      throw new HttpError(401, "Email or password is incorrect");
    }
    if (!providers.includes("email")) {
      user.providers = [...providers, "email"];
      await user.save();
    }
    res.json(await issueSession(user.id));
  }),
);

authRouter.post(
  "/password/forgot",
  asyncHandler(async (req, res) => {
    const input = forgotPasswordSchema.parse(req.body);
    res.json(await requestPasswordReset(input.email));
  }),
);

authRouter.post(
  "/password/reset",
  asyncHandler(async (req, res) => {
    const input = resetPasswordSchema.parse(req.body);
    res.json(await resetPassword(input.email, input.code, input.password));
  }),
);

authRouter.post(
  "/google",
  asyncHandler(async (req, res) => {
    const input = googleAuthSchema.parse(req.body);
    const identity = await verifyGoogleToken(input);
    const session = await loginWithProvider({
      provider: "google",
      subject: identity.subject,
      email: identity.email,
      emailVerified: identity.emailVerified,
      name: identity.name,
    });
    res.json(session);
  }),
);

authRouter.post(
  "/apple",
  asyncHandler(async (req, res) => {
    const input = appleAuthSchema.parse(req.body);
    const identity = await verifyAppleToken(input.identityToken);
    const session = await loginWithProvider({
      provider: "apple",
      subject: identity.subject,
      email: identity.email,
      emailVerified: identity.emailVerified,
      name: input.name || identity.name,
    });
    res.json(session);
  }),
);

authRouter.post(
  "/phone/send",
  asyncHandler(async (req, res) => {
    const input = phoneSchema.parse(req.body);
    const result = await sendPhoneCode(input.phone);
    res.json({ sent: true, ...result });
  }),
);

authRouter.post(
  "/phone/verify",
  asyncHandler(async (req, res) => {
    const input = phoneVerifySchema.parse(req.body);
    await verifyPhoneCode(input.phone, input.code);
    res.json(await loginWithPhone(input.phone));
  }),
);

authRouter.post(
  "/dev/:provider",
  asyncHandler(async (req, res) => {
    if (env.nodeEnv === "production") {
      throw new HttpError(404, "Not found");
    }
    const provider = routeParam(req.params.provider);
    if (provider !== "google" && provider !== "apple") {
      throw new HttpError(404, "Not found");
    }
    const input = devProviderSchema.parse(req.body);
    const session = await loginWithProvider({
      provider,
      subject: `dev:${input.subject}`,
      email: input.email,
      emailVerified: true,
      name: input.name,
    });
    res.json(session);
  }),
);
