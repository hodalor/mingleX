import mongoose from "mongoose";
import { Swipe } from "../models/Swipe.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { toPublicProfile, type ProfileSource } from "../serializers/user.js";
import { Match } from "../models/Match.js";
import { Message } from "../models/Message.js";
import { assertCanUse } from "./billing.js";
import { orderedPair, toMatchDto } from "./matches.js";

const FREE_LIKES_PER_DAY = 20;

export async function recordSwipe(fromUserId: string, toUserId: string, direction: "like" | "pass" | "super") {
  if (!mongoose.isValidObjectId(toUserId)) {
    throw new HttpError(400, "Invalid user id");
  }
  if (fromUserId === toUserId) {
    throw new HttpError(400, "You cannot swipe on yourself");
  }

  const target = await User.findOne({ _id: toUserId, role: "user", isBanned: false });
  if (!target) {
    throw new HttpError(404, "Profile not found");
  }

  if (direction === "super") {
    await assertCanUse(fromUserId, "superLike");
  }
  if (direction === "like" || direction === "super") {
    const alreadyLiked = await Swipe.findOne({
      from: fromUserId,
      to: toUserId,
      direction: { $in: ["like", "super"] },
    });
    if (!alreadyLiked) {
      try {
        await assertCanUse(fromUserId, "unlimitedLikes");
      } catch (error) {
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        const sentToday = await Swipe.countDocuments({
          from: fromUserId,
          direction: { $in: ["like", "super"] },
          createdAt: { $gte: start },
        });
        if (sentToday >= FREE_LIKES_PER_DAY) throw error;
      }
    }
  }

  const swipe = await Swipe.findOneAndUpdate(
    { from: fromUserId, to: toUserId },
    { $set: { direction } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  let match = null;
  if (direction === "like" || direction === "super") {
    const reciprocal = await Swipe.findOne({ from: toUserId, to: fromUserId, direction: { $in: ["like", "super"] } });
    if (reciprocal) {
      const [userA, userB] = orderedPair(fromUserId, toUserId);
      const saved = await Match.findOneAndUpdate(
        { userA, userB },
        { $set: { status: "matched" }, $setOnInsert: { userA, userB } },
        { upsert: true, new: true },
      );
      match = await toMatchDto(saved.id, fromUserId);
    }
  }

  return {
    swipe: {
      id: swipe.id,
      toUserId,
      direction: swipe.direction,
    },
    match,
  };
}

export async function rewindLastSwipe(userId: string) {
  await assertCanUse(userId, "rewind");
  const swipe = await Swipe.findOne({ from: userId }).sort({ createdAt: -1 });
  if (!swipe) {
    throw new HttpError(404, "Nothing to undo.");
  }
  const otherId = swipe.to.toString();
  if (swipe.direction === "like" || swipe.direction === "super") {
    const [userA, userB] = orderedPair(userId, otherId);
    const match = await Match.findOne({ userA, userB, status: { $ne: "pending" } });
    if (match) {
      await Message.deleteMany({ match: match._id });
      await match.deleteOne();
    }
  }
  await swipe.deleteOne();
  const person = await User.findById(otherId);
  return { profile: person ? toPublicProfile(person as unknown as ProfileSource) : null };
}
