import mongoose, { Schema } from "mongoose";

const photoSchema = new Schema(
  {
    url: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
    kind: { type: String, enum: ["image", "video"], default: "image" },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    appleId: { type: String, unique: true, sparse: true },
    providers: {
      type: [String],
      enum: ["email", "google", "apple", "phone"],
      default: [],
    },
    name: { type: String, trim: true, maxlength: 40, default: "" },
    birthDate: { type: Date },
    gender: { type: String, enum: ["woman", "man", "nonbinary"] },
    interestedIn: {
      type: [String],
      enum: ["woman", "man", "nonbinary"],
      default: ["woman", "man", "nonbinary"],
    },
    bio: { type: String, default: "", maxlength: 500 },
    photos: { type: [photoSchema], default: [] },
    interests: { type: [String], default: [] },
    lookingFor: { type: String, enum: ["", "relationship", "casual", "friends", "not_sure"], default: "" },
    drinking: { type: String, enum: ["", "never", "socially", "often"], default: "" },
    smoking: { type: String, enum: ["", "never", "socially", "often"], default: "" },
    workout: { type: String, enum: ["", "never", "sometimes", "often"], default: "" },
    pets: { type: String, enum: ["", "dog", "cat", "both", "none", "other"], default: "" },
    education: { type: String, enum: ["", "high_school", "college", "grad"], default: "" },
    kids: { type: String, enum: ["", "want", "have", "dont_want", "not_sure"], default: "" },
    heightCm: { type: Number, min: 140, max: 220 },
    jobTitle: { type: String, default: "", maxlength: 60 },
    city: { type: String, default: "", maxlength: 80 },
    location: {
      type: new Schema(
        {
          type: { type: String, enum: ["Point"], required: true },
          coordinates: { type: [Number], required: true },
        },
        { _id: false },
      ),
      required: false,
    },
    discoveryRadiusKm: { type: Number, default: 100, min: 1, max: 500 },
    discoveryMinAge: { type: Number, default: 18, min: 18, max: 100 },
    discoveryMaxAge: { type: Number, default: 80, min: 18, max: 100 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
    deleteReason: { type: String, default: "" },
    paidAccess: { type: Boolean, default: false },
    photoCheck: { type: String, enum: ["none", "pending", "verified"], default: "none" },
    videoCheck: { type: String, enum: ["none", "pending", "verified"], default: "none" },
    verificationPhoto: { type: String, default: "" },
    verificationVideo: { type: String, default: "" },
    boostedUntil: { type: Date },
    deviceTokens: { type: [String], default: [] },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

userSchema.pre("save", function () {
  const coordinates = this.location?.coordinates;
  const valid = this.location?.type === "Point" && Array.isArray(coordinates) && coordinates.length === 2;
  if (!valid) {
    this.set("location", undefined);
  }
});

userSchema.index({ location: "2dsphere" });

export const User = mongoose.model("User", userSchema);
