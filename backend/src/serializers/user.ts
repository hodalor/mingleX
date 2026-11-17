import { ageFromBirthDate } from "../utils/age.js";

export type ProfileSource = {
  _id: { toString(): string };
  name: string;
  birthDate?: Date | null;
  gender?: string | null;
  bio: string;
  photos: { url: string; isPrimary: boolean; kind?: string | null }[];
  photoCheck?: string | null;
  videoCheck?: string | null;
  interests: string[];
  lookingFor?: string | null;
  drinking?: string | null;
  smoking?: string | null;
  workout?: string | null;
  pets?: string | null;
  education?: string | null;
  kids?: string | null;
  heightCm?: number | null;
  jobTitle: string;
  city: string;
  phone?: string | null;
  location?: { coordinates?: number[] | null } | null;
};

export type AccountSource = ProfileSource & {
  email?: string | null;
  phone?: string | null;
  providers?: string[] | null;
  role: string;
  interestedIn?: string[] | null;
  discoveryRadiusKm?: number;
  discoveryMinAge?: number;
  discoveryMaxAge?: number;
  isBanned?: boolean;
  banReason?: string;
  deletedAt?: Date | null;
  deleteReason?: string;
  paidAccess?: boolean;
  verificationPhoto?: string | null;
  verificationVideo?: string | null;
  createdAt?: Date;
  lastActiveAt?: Date;
};

export function needsOnboarding(user: {
  name?: string | null;
  birthDate?: Date | null;
  gender?: string | null;
}): boolean {
  return !user.name?.trim() || !user.birthDate || !user.gender;
}

export function toPublicProfile(user: ProfileSource, distanceKm?: number) {
  return {
    id: user._id.toString(),
    name: user.name,
    age: user.birthDate ? ageFromBirthDate(user.birthDate) : null,
    gender: user.gender ?? "",
    bio: user.bio,
    photos: user.photos.map((photo) => ({
      url: photo.url,
      isPrimary: Boolean(photo.isPrimary),
      kind: photo.kind === "video" ? "video" as const : "image" as const,
    })),
    verified: user.photoCheck === "verified",
    videoVerified: user.videoCheck === "verified",
    interests: [...user.interests],
    lookingFor: user.lookingFor || null,
    drinking: user.drinking || null,
    smoking: user.smoking || null,
    workout: user.workout || null,
    pets: user.pets || null,
    education: user.education || null,
    kids: user.kids || null,
    heightCm: user.heightCm ?? null,
    jobTitle: user.jobTitle,
    city: user.city,
    ...(distanceKm === undefined ? {} : { distanceKm: Math.round(distanceKm * 10) / 10 }),
  };
}

export function toMe(user: AccountSource) {
  const coordinates = user.location?.coordinates;
  return {
    ...toPublicProfile(user),
    email: user.email ?? null,
    phone: user.phone ?? null,
    providers: [...(user.providers ?? [])],
    role: user.role,
    paidAccess: Boolean(user.paidAccess),
    photoCheck: user.photoCheck === "pending" || user.photoCheck === "verified" ? user.photoCheck : "none",
    videoCheck: user.videoCheck === "pending" || user.videoCheck === "verified" ? user.videoCheck : "none",
    interestedIn: [...(user.interestedIn ?? [])],
    needsOnboarding: needsOnboarding(user),
    discoveryRadiusKm: user.discoveryRadiusKm ?? 100,
    discoveryMinAge: user.discoveryMinAge ?? 18,
    discoveryMaxAge: user.discoveryMaxAge ?? 80,
    location:
      coordinates && coordinates.length === 2
        ? { lng: coordinates[0], lat: coordinates[1] }
        : null,
    profileIncomplete: user.photos.length === 0 || needsOnboarding(user),
  };
}

export function toAdminUser(user: AccountSource) {
  return {
    ...toMe(user),
    isBanned: Boolean(user.isBanned),
    banReason: user.banReason ?? "",
    deletedAt: user.deletedAt ?? null,
    deleteReason: user.deleteReason ?? "",
    paidAccess: Boolean(user.paidAccess),
    verificationPhoto: user.verificationPhoto || null,
    verificationVideo: user.verificationVideo || null,
    createdAt: user.createdAt ?? null,
    lastActiveAt: user.lastActiveAt ?? null,
    birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
  };
}

export function distanceKm(from: number[], to: number[]): number | undefined {
  if (from.length !== 2 || to.length !== 2) {
    return undefined;
  }
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to[1] - from[1]);
  const dLng = toRad(to[0] - from[0]);
  const lat1 = toRad(from[1]);
  const lat2 = toRad(to[1]);
  const haversine =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(haversine)));
}
