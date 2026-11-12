import mongoose from "mongoose";
import { Block } from "../models/Block.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (!mongoose.isValidObjectId(blockedId)) {
    throw new HttpError(400, "Invalid user id");
  }
  if (blockerId === blockedId) {
    throw new HttpError(400, "You cannot block yourself");
  }

  const target = await User.findById(blockedId).select("_id");
  if (!target) {
    throw new HttpError(404, "Profile not found");
  }

  await Block.findOneAndUpdate(
    { blocker: blockerId, blocked: blockedId },
    { $setOnInsert: { blocker: blockerId, blocked: blockedId } },
    { upsert: true },
  );
}

export async function hiddenUserIds(userId: string) {
  const [outgoing, incoming] = await Promise.all([
    Block.find({ blocker: userId }).distinct("blocked"),
    Block.find({ blocked: userId }).distinct("blocker"),
  ]);
  return [...outgoing, ...incoming];
}

export async function isBlockedPair(leftId: string, rightId: string): Promise<boolean> {
  const block = await Block.exists({
    $or: [
      { blocker: leftId, blocked: rightId },
      { blocker: rightId, blocked: leftId },
    ],
  });
  return block !== null;
}
