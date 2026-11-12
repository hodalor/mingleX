import mongoose, { Schema } from "mongoose";

const phoneCodeSchema = new Schema(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

phoneCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PhoneCode = mongoose.model("PhoneCode", phoneCodeSchema);
