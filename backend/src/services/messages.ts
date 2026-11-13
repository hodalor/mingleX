import mongoose from "mongoose";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { toMessage } from "../serializers/message.js";
import { isBlockedPair } from "./blocks.js";
import { notifyUser } from "./firebase.js";
import { findMemberMatch } from "./matches.js";

export async function createMessage(matchId: string, senderId: string, text: string) {
  const match = await findMemberMatch(matchId, senderId);
  if (!match) {
    return { error: "Match not found" as const };
  }
  const otherId = match.userA.equals(senderId) ? match.userB.toString() : match.userA.toString();
  if (await isBlockedPair(senderId, otherId)) {
    return { error: "This conversation is closed" as const };
  }

  const message = await Message.create({
    match: match._id,
    sender: new mongoose.Types.ObjectId(senderId),
    text,
  });
  match.lastMessageAt = message.createdAt;
  await match.save();
  const sender = await User.findById(senderId).select("name");
  const preview = text.length > 140 ? `${text.slice(0, 137)}...` : text;
  void notifyUser(otherId, "New message", `${sender?.name || "Someone"}: ${preview}`);
  return { message: toMessage(message) };
}

export async function markIncomingRead(matchId: string, readerId: string): Promise<Date | null> {
  if (!mongoose.isValidObjectId(matchId) || !mongoose.isValidObjectId(readerId)) {
    return null;
  }
  const readAt = new Date();
  const result = await Message.updateMany(
    {
      match: new mongoose.Types.ObjectId(matchId),
      sender: { $ne: new mongoose.Types.ObjectId(readerId) },
      readAt: null,
    },
    { $set: { readAt } },
  );
  return result.modifiedCount > 0 ? readAt : null;
}
