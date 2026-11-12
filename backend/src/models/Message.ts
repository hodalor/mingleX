import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
  {
    match: { type: Schema.Types.ObjectId, ref: "Match", required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 2000 },
    readAt: { type: Date },
  },
  { timestamps: true },
);

messageSchema.index({ match: 1, createdAt: -1 });

export const Message = mongoose.model("Message", messageSchema);
