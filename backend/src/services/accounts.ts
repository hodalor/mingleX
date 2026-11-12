import { User } from "../models/User.js";
import { needsOnboarding, toMe, type AccountSource } from "../serializers/user.js";
import { HttpError } from "../utils/httpError.js";
import { signToken, type UserRole } from "../utils/tokens.js";

type ProviderName = "google" | "apple";

export async function issueSession(userId: string) {
  const user = await User.findById(userId);
  if (!user || user.isBanned) {
    throw new HttpError(user?.isBanned ? 403 : 401, user?.isBanned ? "This account is banned" : "Account unavailable");
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

export async function loginWithPhone(phone: string) {
  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({
      phone,
      providers: ["phone"],
      name: "",
      interestedIn: ["woman", "man", "nonbinary"],
    });
  } else {
    user.set("providers", addProvider(user.providers, "phone"));
    await user.save();
  }
  return issueSession(user.id);
}
