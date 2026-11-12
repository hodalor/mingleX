import mongoose, { Schema } from "mongoose";

const matchSchema = new Schema(
  {
    userA: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userB: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastMessageAt: { type: Date },
    status: { type: String, enum: ["matched", "pending"], default: "matched" },
  },
  { timestamps: true },
);

matchSchema.index({ userA: 1, userB: 1 }, { unique: true });
matchSchema.index({ userA: 1, lastMessageAt: -1 });
matchSchema.index({ userB: 1, lastMessageAt: -1 });

export const Match = mongoose.model("Match", matchSchema);
