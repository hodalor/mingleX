import mongoose, { Schema } from "mongoose";

const signupCodeSchema = new Schema(
  {
    channel: { type: String, enum: ["email", "phone"], required: true },
    target: { type: String, required: true, trim: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

signupCodeSchema.index({ channel: 1, target: 1 });
signupCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SignupCode = mongoose.model("SignupCode", signupCodeSchema);
