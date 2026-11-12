import { OAuth2Client } from "google-auth-library";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

const googleClient = new OAuth2Client();
const appleKeys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export type ProviderIdentity = {
  subject: string;
  email?: string;
  emailVerified: boolean;
  name: string;
};

export async function verifyGoogleToken(input: { idToken?: string; accessToken?: string }): Promise<ProviderIdentity> {
  if (!env.googleClientId && input.idToken) {
    throw new HttpError(503, "Google sign-in is not configured");
  }
  if (input.idToken) {
    if (!env.googleClientId) {
      throw new HttpError(503, "Google sign-in is not configured");
    }
    const ticket = await googleClient.verifyIdToken({
      idToken: input.idToken,
      audience: env.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      throw new HttpError(401, "Google sign-in failed");
    }
    return {
      subject: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.given_name || payload.name || "",
    };
  }

  if (!input.accessToken) {
    throw new HttpError(400, "Missing Google token");
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  if (!response.ok) {
    throw new HttpError(401, "Google sign-in failed");
  }
  const payload = (await response.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    given_name?: string;
    name?: string;
  };
  if (!payload.sub) {
    throw new HttpError(401, "Google sign-in failed");
  }
  return {
    subject: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: payload.given_name || payload.name || "",
  };
}

export async function verifyAppleToken(identityToken: string): Promise<ProviderIdentity> {
  if (env.appleClientIds.length === 0) {
    throw new HttpError(503, "Apple sign-in is not configured");
  }
  try {
    const { payload } = await jwtVerify(identityToken, appleKeys, {
      issuer: "https://appleid.apple.com",
      audience: env.appleClientIds,
    });
    if (!payload.sub) {
      throw new HttpError(401, "Apple sign-in failed");
    }
    const emailVerified = payload.email_verified === true || payload.email_verified === "true";
    return {
      subject: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      emailVerified,
      name: "",
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(401, "Apple sign-in failed");
  }
}
