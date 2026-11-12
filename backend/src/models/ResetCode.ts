import mongoose, { Schema } from "mongoose";

const resetCodeSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

resetCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ResetCode = mongoose.model("ResetCode", resetCodeSchema);
