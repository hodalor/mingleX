import mongoose from "mongoose";
import { Match } from "../models/Match.js";
import { Swipe } from "../models/Swipe.js";
import { User } from "../models/User.js";
import { distanceKm, toPublicProfile, type ProfileSource } from "../serializers/user.js";
import { HttpError } from "../utils/httpError.js";
import { assertCanUse, canUse } from "./billing.js";
import { isBlockedPair, hiddenUserIds } from "./blocks.js";
import { orderedPair, toMatchDto } from "./matches.js";

async function profilesFor(ids: string[], superIds: Set<string>, from?: number[] | null) {
  if (ids.length === 0) return [];
  const people = await User.find({ _id: { $in: ids }, role: "user", isBanned: false, deletedAt: null });
  const byId = new Map(people.map((person) => [person.id, person]));
  return ids.flatMap((id) => {
    const person = byId.get(id);
    if (!person) return [];
    const source = person as unknown as ProfileSource;
    const to = source.location?.coordinates;
    const km = from && to ? distanceKm(from, to) : undefined;
    return [{ ...toPublicProfile(source, km), phone: person.phone || null, superLike: superIds.has(id) }];
  });
}

export async function listRequests(userId: string) {
  const me = new mongoose.Types.ObjectId(userId);
  const [incomingLikes, outgoingLikes, myPasses, theirPasses, matches, hidden] = await Promise.all([
    Swipe.find({ to: me, direction: { $in: ["like", "super"] } }).sort({ createdAt: -1 }).limit(100),
    Swipe.find({ from: me, direction: { $in: ["like", "super"] } }).sort({ createdAt: -1 }).limit(100),
    Swipe.find({ from: me, direction: "pass" }).distinct("to"),
    Swipe.find({ to: me, direction: "pass" }).distinct("from"),
    Match.find({ $or: [{ userA: me }, { userB: me }], status: { $ne: "pending" } }),
    hiddenUserIds(userId),
  ]);
  const matched = new Set(matches.flatMap((match) => [match.userA.toString(), match.userB.toString()]));
  matched.delete(userId);
  const passed = new Set(myPasses.map((id) => id.toString()));
  const rejected = new Set(theirPasses.map((id) => id.toString()));
  const hiddenIds = new Set(hidden.map((id) => id.toString()));
  const incomingIds = incomingLikes
    .map((swipe) => swipe.from.toString())
    .filter((id) => !matched.has(id) && !passed.has(id) && !hiddenIds.has(id));
  const outgoingIds = outgoingLikes
    .map((swipe) => swipe.to.toString())
    .filter((id) => !matched.has(id) && !rejected.has(id) && !hiddenIds.has(id));
  const incomingSuper = new Set(incomingLikes.filter((swipe) => swipe.direction === "super").map((swipe) => swipe.from.toString()));
  const outgoingSuper = new Set(outgoingLikes.filter((swipe) => swipe.direction === "super").map((swipe) => swipe.to.toString()));
  const allowed = await canUse(userId, "likesYou");
  const viewer = await User.findById(userId).select("location");
  const from = viewer?.location?.coordinates;
  return {
    incomingLocked: !allowed,
    incoming: allowed ? await profilesFor(incomingIds, incomingSuper, from) : [],
    outgoing: await profilesFor(outgoingIds, outgoingSuper, from),
  };
}

export async function openRequestThread(userId: string, otherUserId: string) {
  if (!mongoose.isValidObjectId(otherUserId) || userId === otherUserId) {
    throw new HttpError(400, "That person is not available.");
  }
  if (await isBlockedPair(userId, otherUserId)) {
    throw new HttpError(403, "This conversation is closed");
  }
  const [userA, userB] = orderedPair(userId, otherUserId);
  const existing = await Match.findOne({ userA, userB });
  if (existing && existing.status !== "pending") {
    return toMatchDto(existing.id, userId);
  }
  const liked = await Swipe.findOne({
    $or: [
      { from: userId, to: otherUserId, direction: { $in: ["like", "super"] } },
      { from: otherUserId, to: userId, direction: { $in: ["like", "super"] } },
    ],
  });
  if (!liked) {
    throw new HttpError(400, "Send a like before starting a chat.");
  }
  await assertCanUse(userId, "requestChat");
  const match = existing ?? await Match.create({ userA, userB, status: "pending" });
  return toMatchDto(match.id, userId);
}
