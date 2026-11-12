import { z } from "zod";

export const genderSchema = z.enum(["woman", "man", "nonbinary"]);

export const registerSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(1).max(40),
  birthDate: z.string().trim().min(8).max(40),
  gender: genderSchema,
  interestedIn: z.array(genderSchema).min(1).max(3).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(1).max(72),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(160),
});

export const resetPasswordSchema = forgotPasswordSchema.extend({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  password: z.string().min(8).max(72),
});

export const photoSchema = z.object({
  url: z.string().trim().max(500).refine(
    (value) => value.startsWith("/uploads/") || value.startsWith("http://") || value.startsWith("https://"),
    "Photo address is not valid",
  ),
  isPrimary: z.boolean().optional(),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    bio: z.string().trim().max(500).optional(),
    jobTitle: z.string().trim().max(60).optional(),
    city: z.string().trim().max(80).optional(),
    gender: genderSchema.optional(),
    interestedIn: z.array(genderSchema).min(1).max(3).optional(),
    interests: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
    lookingFor: z.enum(["relationship", "casual", "friends", "not_sure"]).nullable().optional(),
    drinking: z.enum(["never", "socially", "often"]).nullable().optional(),
    smoking: z.enum(["never", "socially", "often"]).nullable().optional(),
    workout: z.enum(["never", "sometimes", "often"]).nullable().optional(),
    pets: z.enum(["dog", "cat", "both", "none", "other"]).nullable().optional(),
    education: z.enum(["high_school", "college", "grad"]).nullable().optional(),
    kids: z.enum(["want", "have", "dont_want", "not_sure"]).nullable().optional(),
    heightCm: z.number().int().min(140).max(220).nullable().optional(),
    photos: z.array(photoSchema).max(6).optional(),
    discoveryRadiusKm: z.number().int().min(1).max(500).optional(),
    discoveryMinAge: z.number().int().min(18).max(100).optional(),
    discoveryMaxAge: z.number().int().min(18).max(100).optional(),
    birthDate: z.string().trim().min(8).max(40).optional(),
    location: z
      .object({
        lng: z.number().min(-180).max(180),
        lat: z.number().min(-90).max(90),
      })
      .nullable()
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes provided" });

export const discoverQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  radiusKm: z.coerce.number().min(1).max(500).optional(),
});

export const swipeSchema = z.object({
  toUserId: z.string().trim().min(1),
  direction: z.enum(["like", "pass", "super"]),
});

export const messageSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export const messageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const blockSchema = z.object({
  userId: z.string().trim().min(1),
});

export const reportSchema = z.object({
  reportedUserId: z.string().trim().min(1),
  reason: z.enum(["harassment", "fake", "spam", "underage", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export const banSchema = z.object({
  banned: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

export const paidAccessSchema = z.object({
  paidAccess: z.boolean(),
});

export const serviceFlagsSchema = z
  .object({
    likesYou: z.boolean().optional(),
    matchChat: z.boolean().optional(),
    requestChat: z.boolean().optional(),
    readReceipts: z.boolean().optional(),
    rewind: z.boolean().optional(),
    unlimitedLikes: z.boolean().optional(),
    superLike: z.boolean().optional(),
    boost: z.boolean().optional(),
    passport: z.boolean().optional(),
    hideAds: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes provided" });

export const reportStatusSchema = z.object({
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
});

export const googleAuthSchema = z
  .object({
    idToken: z.string().trim().min(20).optional(),
    accessToken: z.string().trim().min(20).optional(),
  })
  .refine((value) => value.idToken || value.accessToken, { message: "Missing Google token" });

export const appleAuthSchema = z.object({
  identityToken: z.string().trim().min(20),
  name: z.string().trim().max(40).optional(),
});

export const phoneSchema = z.object({
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Use a full phone number like +15551234567"),
});

export const phoneVerifySchema = phoneSchema.extend({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const devProviderSchema = z.object({
  subject: z.string().trim().min(8).max(80),
  email: z.string().trim().email().max(160),
  name: z.string().trim().max(40).optional(),
});
