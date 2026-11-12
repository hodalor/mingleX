import mongoose, { Schema } from "mongoose";

const flag = { type: Boolean, default: false };

const settingSchema = new Schema(
  {
    _id: { type: String },
    likesYou: flag,
    matchChat: flag,
    requestChat: flag,
    readReceipts: flag,
    rewind: flag,
    unlimitedLikes: flag,
    superLike: flag,
    boost: flag,
    passport: flag,
    hideAds: flag,
  },
  { timestamps: true },
);

export const Setting = mongoose.model("Setting", settingSchema);
