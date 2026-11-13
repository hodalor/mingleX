import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";

export function firebaseConfigured(): boolean {
  return Boolean(env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey);
}

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: cert({
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey.replace(/\\n/g, "\n"),
    }),
  });
}

export async function phoneFromFirebaseToken(idToken: string): Promise<string> {
  if (!firebaseConfigured()) {
    throw new HttpError(503, "Phone sign-in is not set up yet");
  }
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(idToken);
    const phone = decoded.phone_number;
    if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
      throw new HttpError(401, "That phone sign-in could not be confirmed");
    }
    return phone;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "That phone sign-in could not be confirmed");
  }
}

export async function notifyUser(userId: string, title: string, body: string): Promise<void> {
  if (!firebaseConfigured()) return;
  const user = await User.findById(userId).select("deviceTokens");
  const tokens = (user?.deviceTokens ?? []).filter((token) => token.length > 0);
  if (tokens.length === 0) return;
  try {
    const response = await getMessaging(adminApp()).sendEachForMulticast({
      tokens,
      notification: { title, body },
    });
    const stale = tokens.filter((_, index) => {
      const code = response.responses[index]?.error?.code ?? "";
      return code.includes("registration-token-not-registered") || code.includes("invalid-registration-token");
    });
    if (stale.length > 0) {
      await User.updateOne({ _id: userId }, { $pull: { deviceTokens: { $in: stale } } });
    }
  } catch {
    console.error("Push notification failed");
  }
}

// Alerts stay quiet until the Firebase keys are set.

