import { Router } from "express";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { toMe, type AccountSource } from "../serializers/user.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isAtLeast18, parseBirthDate } from "../utils/age.js";
import { HttpError } from "../utils/httpError.js";
import { acceptPhoto, isVideoFile, publishPhoto, removeStoredPhoto } from "../uploads.js";
import { deviceTokenSchema, firebasePhoneSchema, phoneSchema, phoneVerifySchema, updateProfileSchema } from "../validation/schemas.js";
import { assertCanUse } from "../services/billing.js";
import { phoneFromFirebaseToken } from "../services/firebase.js";
import { sendPhoneCode, verifyPhoneCode } from "../services/phone.js";

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) {
      throw new HttpError(401, "Account unavailable");
    }
    res.json({ user: toMe(user as unknown as AccountSource) });
  }),
);

profileRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const input = updateProfileSchema.parse(req.body);
    const user = await User.findById(req.userId);
    if (!user) {
      throw new HttpError(401, "Account unavailable");
    }

    if (input.name !== undefined) user.name = input.name;
    if (input.bio !== undefined) user.bio = input.bio;
    if (input.jobTitle !== undefined) user.jobTitle = input.jobTitle;
    if (input.city !== undefined) user.city = input.city;
    if (input.gender !== undefined) user.gender = input.gender;
    if (input.birthDate !== undefined) {
      let birthDate: Date;
      try {
        birthDate = parseBirthDate(input.birthDate);
      } catch {
        throw new HttpError(400, "Birth date must be a real date in YYYY-MM-DD form");
      }
      if (birthDate.getTime() > Date.now() || !isAtLeast18(birthDate)) {
        throw new HttpError(403, "mingleX is for adults 18 and older");
      }
      user.birthDate = birthDate;
    }
    if (input.interestedIn !== undefined) user.interestedIn = input.interestedIn;
    if (input.interests !== undefined) user.interests = input.interests;
    for (const key of ["lookingFor", "drinking", "smoking", "workout", "pets", "education", "kids"] as const) {
      const value = input[key];
      if (value !== undefined) user.set(key, value ?? "");
    }
    if (input.heightCm === null) user.set("heightCm", undefined);
    else if (input.heightCm !== undefined) user.heightCm = input.heightCm;
    if (input.discoveryRadiusKm !== undefined) user.discoveryRadiusKm = input.discoveryRadiusKm;
    if (input.discoveryMinAge !== undefined || input.discoveryMaxAge !== undefined) {
      const minAge = input.discoveryMinAge ?? user.discoveryMinAge ?? 18;
      const maxAge = input.discoveryMaxAge ?? user.discoveryMaxAge ?? 80;
      if (minAge > maxAge) {
        throw new HttpError(400, "The youngest age can't be above the oldest age");
      }
      user.discoveryMinAge = minAge;
      user.discoveryMaxAge = maxAge;
    }

    if (input.photos !== undefined) {
      const photos = input.photos.map((photo) => ({
        url: photo.url,
        isPrimary: photo.isPrimary ?? false,
      }));
      if (photos.length > 0 && !photos.some((photo) => photo.isPrimary)) {
        photos[0].isPrimary = true;
      }
      user.set("photos", photos);
    }

    if (input.location === null) {
      user.set("location", undefined);
    } else if (input.location) {
      await assertCanUse(req.userId!, "passport");
      user.set("location", {
        type: "Point",
        coordinates: [input.location.lng, input.location.lat],
      });
    }

    await user.save();
    res.json({ user: toMe(user as unknown as AccountSource) });
  }),
);

profileRouter.post(
  "/boost",
  asyncHandler(async (req, res) => {
    await assertCanUse(req.userId!, "boost");
    const user = await User.findById(req.userId);
    if (!user) throw new HttpError(401, "Account unavailable");
    user.boostedUntil = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    res.json({ boostedUntil: user.boostedUntil });
  }),
);

profileRouter.post(
  "/photos",
  acceptPhoto,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, "Choose a photo");
    }
    const user = await User.findById(req.userId);
    if (!user) {
      throw new HttpError(401, "Account unavailable");
    }
    const video = isVideoFile(req.file);
    const images = user.photos.filter((photo) => photo.kind !== "video");
    if (!video && images.length >= 6) {
      throw new HttpError(400, "You can add up to 6 photos");
    }
    if (video && user.photos.some((photo) => photo.kind === "video")) {
      throw new HttpError(400, "You can add one video");
    }
    const url = await publishPhoto(req.file);
    const photos = [
      ...user.photos.map((photo) => ({
        url: photo.url,
        isPrimary: Boolean(photo.isPrimary),
        kind: photo.kind === "video" ? "video" : "image",
      })),
      { url, isPrimary: user.photos.length === 0, kind: video ? "video" : "image" },
    ];
    try {
      user.set("photos", photos);
      await user.save();
    } catch (error) {
      removeStoredPhoto(url);
      throw error;
    }
    res.status(201).json({ user: toMe(user as unknown as AccountSource) });
  }),
);

profileRouter.delete(
  "/photos",
  asyncHandler(async (req, res) => {
    const url = typeof req.body?.url === "string" ? req.body.url : "";
    const storedHere = url.startsWith("/uploads/") || url.startsWith("https://storage.googleapis.com/");
    if (!storedHere) {
      throw new HttpError(400, "That photo cannot be removed");
    }
    const user = await User.findById(req.userId);
    if (!user) {
      throw new HttpError(401, "Account unavailable");
    }
    const photos = user.photos
      .filter((photo) => photo.url !== url)
      .map((photo) => ({
        url: photo.url,
        isPrimary: Boolean(photo.isPrimary),
        kind: photo.kind === "video" ? "video" : "image",
      }));
    if (photos.length === user.photos.length) {
      throw new HttpError(404, "Photo not found");
    }
    if (photos.length > 0 && !photos.some((photo) => photo.isPrimary)) {
      photos[0]!.isPrimary = true;
    }
    user.set("photos", photos);
    await user.save();
    removeStoredPhoto(url);
    res.json({ user: toMe(user as unknown as AccountSource) });
  }),
);

profileRouter.post(
  "/phone/send",
  asyncHandler(async (req, res) => {
    const input = phoneSchema.parse(req.body);
    const taken = await User.findOne({ phone: input.phone, _id: { $ne: req.userId } });
    if (taken) {
      throw new HttpError(409, "That number is already on another account");
    }
    const result = await sendPhoneCode(input.phone);
    res.json({ sent: true, ...result });
  }),
);

profileRouter.post(
  "/phone/verify",
  asyncHandler(async (req, res) => {
    const input = phoneVerifySchema.parse(req.body);
    const taken = await User.findOne({ phone: input.phone, _id: { $ne: req.userId } });
    if (taken) {
      throw new HttpError(409, "That number is already on another account");
    }
    await verifyPhoneCode(input.phone, input.code);
    const user = await User.findById(req.userId);
    if (!user) throw new HttpError(401, "Account unavailable");
    user.phone = input.phone;
    const providers = user.providers ?? [];
    if (!providers.includes("phone")) user.providers = [...providers, "phone"];
    await user.save();
    res.json({ user: toMe(user as unknown as AccountSource) });
  }),
);

profileRouter.post(
  "/phone/firebase",
  asyncHandler(async (req, res) => {
    const input = firebasePhoneSchema.parse(req.body);
    const phone = await phoneFromFirebaseToken(input.idToken);
    const taken = await User.findOne({ phone, _id: { $ne: req.userId } });
    if (taken) throw new HttpError(409, "That number is already on another account");
    const user = await User.findById(req.userId);
    if (!user) throw new HttpError(401, "Account unavailable");
    user.phone = phone;
    const providers = user.providers ?? [];
    if (!providers.includes("phone")) user.providers = [...providers, "phone"];
    await user.save();
    res.json({ user: toMe(user as unknown as AccountSource) });
  }),
);

profileRouter.delete(
  "/phone",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) throw new HttpError(401, "Account unavailable");
    if (!user.email && !user.googleId && !user.appleId) {
      throw new HttpError(400, "Add an email before removing this number");
    }
    user.set("phone", undefined);
    user.providers = (user.providers ?? []).filter((provider) => provider !== "phone");
    await user.save();
    res.json({ user: toMe(user as unknown as AccountSource) });
  }),
);

profileRouter.post(
  "/verification/photo",
  acceptPhoto,
  asyncHandler(async (req, res) => {
    if (!req.file || isVideoFile(req.file)) throw new HttpError(400, "Choose a photo of your face");
    const user = await User.findById(req.userId);
    if (!user) throw new HttpError(401, "Account unavailable");
    const previous = user.verificationPhoto;
    const url = await publishPhoto(req.file);
    user.verificationPhoto = url;
    user.photoCheck = "pending";
    try {
      await user.save();
    } catch (error) {
      removeStoredPhoto(url);
      throw error;
    }
    if (previous) removeStoredPhoto(previous);
    res.status(201).json({ user: toMe(user as unknown as AccountSource) });
  }),
);

profileRouter.post(
  "/verification/video",
  acceptPhoto,
  asyncHandler(async (req, res) => {
    if (!req.file || !isVideoFile(req.file)) throw new HttpError(400, "Choose a short video of your face");
    const user = await User.findById(req.userId);
    if (!user) throw new HttpError(401, "Account unavailable");
    const previous = user.verificationVideo;
    const url = await publishPhoto(req.file);
    user.verificationVideo = url;
    user.videoCheck = "pending";
    try {
      await user.save();
    } catch (error) {
      removeStoredPhoto(url);
      throw error;
    }
    if (previous) removeStoredPhoto(previous);
    res.status(201).json({ user: toMe(user as unknown as AccountSource) });
  }),
);

profileRouter.post(
  "/device",
  asyncHandler(async (req, res) => {
    const input = deviceTokenSchema.parse(req.body);
    await User.updateOne({ _id: req.userId }, { $addToSet: { deviceTokens: input.token } });
    res.json({ saved: true });
  }),
);
