import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDb } from "../config/db.js";
import { User } from "../models/User.js";

const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "mingleX Admin";

if (!email || !password || password.length < 8) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) in backend/.env");
  process.exit(1);
}

await connectDb();

const passwordHash = await bcrypt.hash(password, 12);
await User.findOneAndUpdate(
  { email },
  {
    $set: {
      name,
      passwordHash,
      role: "admin",
      isBanned: false,
      birthDate: new Date(Date.UTC(1990, 0, 1)),
      gender: "nonbinary",
      interestedIn: ["woman", "man", "nonbinary"],
    },
    $unset: { location: "" },
    $setOnInsert: { email },
  },
  { upsert: true, new: true, runValidators: true },
);

console.log(`Admin ready: ${email}`);
await mongoose.disconnect();
