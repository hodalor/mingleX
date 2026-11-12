import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDb } from "../config/db.js";
import { User } from "../models/User.js";

type Gender = "woman" | "man" | "nonbinary";

type Seed = {
  email: string;
  password: string;
  name: string;
  birthDate: Date;
  gender: Gender;
  interestedIn: Gender[];
  bio: string;
  jobTitle: string;
  city: string;
  interests: string[];
  lookingFor: string;
  drinking: string;
  smoking: string;
  workout: string;
  pets: string;
  education: string;
  kids: string;
  heightCm: number | null;
  photo?: string;
  lng: number;
  lat: number;
};

function applyAbout(user: {
  set: (path: string, value: unknown) => void;
  interests: string[];
}, seed: Seed) {
  user.interests = seed.interests;
  user.set("lookingFor", seed.lookingFor);
  user.set("drinking", seed.drinking);
  user.set("smoking", seed.smoking);
  user.set("workout", seed.workout);
  user.set("pets", seed.pets);
  user.set("education", seed.education);
  user.set("kids", seed.kids);
  user.set("heightCm", seed.heightCm);
}

function aboutIsFilled(seed: Seed): boolean {
  return Boolean(
    seed.lookingFor || seed.drinking || seed.smoking || seed.workout || seed.pets || seed.education || seed.kids || seed.heightCm,
  );
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < 8) {
    console.error(`Set ${name} to a password of at least 8 characters`);
    process.exit(1);
  }
  return value;
}

if ((process.env.NODE_ENV ?? "development") === "production") {
  console.error("Refusing to seed test members when NODE_ENV=production");
  process.exit(1);
}

const seeds: Seed[] = [
  {
    email: "ada@minglex.app",
    password: required("TEST_ADA_PASSWORD"),
    name: "Ada",
    birthDate: new Date(Date.UTC(1996, 3, 12)),
    gender: "woman",
    interestedIn: ["man"],
    bio: "Test account. Add a photo, then Jordan should be in the deck.",
    jobTitle: "Designer",
    city: "Lisbon",
    interests: ["Markets", "Walking"],
    lookingFor: "",
    drinking: "",
    smoking: "",
    workout: "",
    pets: "",
    education: "",
    kids: "",
    heightCm: null,
    lng: -9.1393,
    lat: 38.7223,
  },
  {
    email: "jordan@minglex.app",
    password: required("TEST_JORDAN_PASSWORD"),
    name: "Jordan",
    birthDate: new Date(Date.UTC(1994, 8, 3)),
    gender: "man",
    interestedIn: ["woman"],
    bio: "Seeded so Ada has someone to swipe.",
    jobTitle: "Gardener",
    city: "Lisbon",
    interests: ["Hiking", "Cooking", "Coffee"],
    lookingFor: "relationship",
    drinking: "socially",
    smoking: "never",
    workout: "sometimes",
    pets: "dog",
    education: "college",
    kids: "not_sure",
    heightCm: 182,
    photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
    lng: -9.142,
    lat: 38.725,
  },
];

await connectDb();

for (const seed of seeds) {
  const passwordHash = await bcrypt.hash(seed.password, 12);
  const existing = await User.findOne({ email: seed.email });
  if (!existing) {
    await User.create({
      email: seed.email,
      passwordHash,
      name: seed.name,
      birthDate: seed.birthDate,
      gender: seed.gender,
      interestedIn: seed.interestedIn,
      bio: seed.bio,
      jobTitle: seed.jobTitle,
      city: seed.city,
      interests: seed.interests,
      lookingFor: seed.lookingFor,
      drinking: seed.drinking,
      smoking: seed.smoking,
      workout: seed.workout,
      pets: seed.pets,
      education: seed.education,
      kids: seed.kids,
      ...(seed.heightCm ? { heightCm: seed.heightCm } : {}),
      photos: seed.photo ? [{ url: seed.photo, isPrimary: true }] : [],
      location: { type: "Point", coordinates: [seed.lng, seed.lat] },
      discoveryRadiusKm: 100,
      providers: ["email"],
      role: "user",
      isBanned: false,
    });
    console.log(`Created ${seed.email}`);
    continue;
  }

  existing.set("passwordHash", passwordHash);
  existing.name = seed.name;
  existing.birthDate = seed.birthDate;
  existing.gender = seed.gender;
  existing.interestedIn = seed.interestedIn;
  existing.bio = seed.bio;
  existing.jobTitle = seed.jobTitle;
  existing.city = seed.city;
  if (aboutIsFilled(seed)) applyAbout(existing, seed);
  existing.set("location", { type: "Point", coordinates: [seed.lng, seed.lat] });
  existing.discoveryRadiusKm = 100;
  existing.role = "user";
  existing.isBanned = false;
  if (!existing.providers.includes("email")) {
    existing.providers = [...existing.providers, "email"];
  }
  if (existing.photos.length === 0 && seed.photo) {
    existing.set("photos", [{ url: seed.photo, isPrimary: true }]);
  }
  await existing.save();
  console.log(`Updated ${seed.email}`);
}

await mongoose.disconnect();
