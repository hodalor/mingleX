import mongoose from "mongoose";
import { Match } from "../models/Match.js";
import { Message } from "../models/Message.js";
import { Swipe } from "../models/Swipe.js";
import { toPublicProfile, type ProfileSource } from "../serializers/user.js";

export function orderedPair(leftId: string, rightId: string): [string, string] {
  return leftId < rightId ? [leftId, rightId] : [rightId, leftId];
}

export async function findMemberMatch(matchId: string, userId: string) {
  if (!mongoose.isValidObjectId(matchId) || !mongoose.isValidObjectId(userId)) {
    return null;
  }
  const match = await Match.findById(matchId);
  if (!match) {
    return null;
  }
  const isMember = match.userA.equals(userId) || match.userB.equals(userId);
  return isMember ? match : null;
}

export async function toMatchDto(matchId: string, viewerId: string) {
  const match = await Match.findById(matchId).populate<{ userA: ProfileSource; userB: ProfileSource }>(
    "userA userB",
  );
  if (!match) {
    return null;
  }
  const userA = match.userA as unknown as ProfileSource;
  const userB = match.userB as unknown as ProfileSource;
  const other = userA._id.toString() === viewerId ? userB : userA;
  return {
    id: match.id,
    matchedAt: match.createdAt,
    lastMessageAt: match.lastMessageAt ?? null,
    pending: match.status === "pending",
    unread: 0,
    otherUser: { ...toPublicProfile(other), phone: other.phone || null },
  };
}

export async function removeMatch(matchId: string, userId: string) {
  const match = await findMemberMatch(matchId, userId);
  if (!match) return false;
  await Message.deleteMany({ match: match._id });
  const left = match.userA.toString();
  const right = match.userB.toString();
  await match.deleteOne();
  await Swipe.findOneAndUpdate({ from: left, to: right }, { $set: { direction: "pass" } }, { upsert: true });
  await Swipe.findOneAndUpdate({ from: right, to: left }, { $set: { direction: "pass" } }, { upsert: true });
  return true;
}
