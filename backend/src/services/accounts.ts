import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { needsOnboarding, toMe, type AccountSource } from "../serializers/user.js";
import { HttpError } from "../utils/httpError.js";
import { signToken, type UserRole } from "../utils/tokens.js";
import { signSignupProof } from "./signup.js";

type ProviderName = "google" | "apple";

export async function issueSession(userId: string) {
  const user = await User.findById(userId);
  if (!user || user.isBanned || user.deletedAt) {
    const blocked = Boolean(user?.isBanned || user?.deletedAt);
    throw new HttpError(blocked ? 403 : 401, user?.deletedAt ? "This account was deleted" : user?.isBanned ? "This account is banned" : "Account unavailable");
  }
  user.lastActiveAt = new Date();
  await user.save();
  const role: UserRole = user.role === "admin" ? "admin" : "user";
  const account = user as unknown as AccountSource;
  return {
    token: signToken(user.id, role),
    user: toMe(account),
    needsOnboarding: needsOnboarding(account),
  };
}

function addProvider(providers: string[] | undefined, provider: string): string[] {
  return providers?.includes(provider) ? [...providers] : [...(providers ?? []), provider];
}

export async function loginWithProvider(input: {
  provider: ProviderName;
  subject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
}) {
  const idField = input.provider === "google" ? "googleId" : "appleId";
  const email = input.email?.toLowerCase();
  let user = await User.findOne({ [idField]: input.subject });

  if (!user && email && input.emailVerified) {
    user = await User.findOne({ email });
    if (user) {
      const linkedSubject = user.get(idField) as string | undefined;
      if (linkedSubject && linkedSubject !== input.subject) {
        throw new HttpError(409, `This email is already linked to another ${input.provider} account`);
      }
      user.set(idField, input.subject);
      user.set("providers", addProvider(user.providers, input.provider));
    }
  }

  if (!user) {
    user = await User.create({
      [idField]: input.subject,
      ...(email && input.emailVerified ? { email } : {}),
      name: input.name?.slice(0, 40) ?? "",
      providers: [input.provider],
      interestedIn: ["woman", "man", "nonbinary"],
    });
  } else if (input.name && !user.name) {
    user.name = input.name.slice(0, 40);
  }

  await user.save();
  return issueSession(user.id);
}

export async function continueWithVerifiedPhone(phone: string) {
  const user = await User.findOne({ phone });
  if (!user) {
    return { needsPassword: true as const, phone, proof: signSignupProof("phone", phone) };
  }
  user.set("providers", addProvider(user.providers, "phone"));
  await user.save();
  return issueSession(user.id);
}

export async function completePhoneSignup(input: {
  phone: string;
  password: string;
  name: string;
  birthDate: Date;
  gender: "woman" | "man" | "nonbinary";
}) {
  const existing = await User.findOne({ phone: input.phone });
  if (existing) throw new HttpError(409, "That number already has an account");
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({
    phone: input.phone,
    passwordHash,
    name: input.name,
    birthDate: input.birthDate,
    gender: input.gender,
    providers: ["phone"],
    interestedIn: ["woman", "man", "nonbinary"],
  });
  return issueSession(user.id);
}
