import mongoose, { Schema } from "mongoose";

const swipeSchema = new Schema(
  {
    from: { type: Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: Schema.Types.ObjectId, ref: "User", required: true },
    direction: { type: String, enum: ["like", "pass", "super"], required: true },
  },
  { timestamps: true },
);

swipeSchema.index({ from: 1, to: 1 }, { unique: true });

export const Swipe = mongoose.model("Swipe", swipeSchema);
