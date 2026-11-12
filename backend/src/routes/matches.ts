import { Router } from "express";
import mongoose from "mongoose";
import { Match } from "../models/Match.js";
import { Message } from "../models/Message.js";
import { requireAuth } from "../middleware/auth.js";
import { toMessage } from "../serializers/message.js";
import { distanceKm, toPublicProfile, type ProfileSource } from "../serializers/user.js";
import { User } from "../models/User.js";
import { isBlockedPair } from "../services/blocks.js";
import { createMessage, markIncomingRead } from "../services/messages.js";
import { findMemberMatch, removeMatch } from "../services/matches.js";
import { assertCanUse, canUse } from "../services/billing.js";
import { emitToMatch } from "../socket/emit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { routeParam } from "../utils/params.js";
import { messageQuerySchema, messageSchema } from "../validation/schemas.js";

export const matchesRouter = Router();

matchesRouter.use(requireAuth);

matchesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const matches = await Match.find({
      $or: [{ userA: req.userId }, { userB: req.userId }],
      status: { $ne: "pending" },
    })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .populate("userA userB");

    const visible = [];
    for (const match of matches) {
      const userA = match.userA as unknown as ProfileSource;
      const userB = match.userB as unknown as ProfileSource;
      const other = userA._id.toString() === req.userId ? userB : userA;
      if (await isBlockedPair(req.userId!, other._id.toString())) {
        continue;
      }
      visible.push(match);
    }

    const unreadRows = visible.length
      ? await Message.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
          {
            $match: {
              match: { $in: visible.map((match) => match._id) },
              sender: { $ne: new mongoose.Types.ObjectId(req.userId) },
              readAt: null,
            },
          },
          { $group: { _id: "$match", total: { $sum: 1 } } },
        ])
      : [];
    const unreadByMatch = new Map(unreadRows.map((row) => [row._id.toString(), row.total]));
    const viewer = await User.findById(req.userId).select("location");
    const from = viewer?.location?.coordinates;

    res.json({
      matches: visible.map((match) => {
        const userA = match.userA as unknown as ProfileSource;
        const userB = match.userB as unknown as ProfileSource;
        const other = userA._id.toString() === req.userId ? userB : userA;
        const to = other.location?.coordinates;
        const km = from && to ? distanceKm(from, to) : undefined;
        return {
          id: match.id,
          matchedAt: match.createdAt,
          lastMessageAt: match.lastMessageAt ?? null,
          unread: unreadByMatch.get(match.id) ?? 0,
          otherUser: toPublicProfile(other, km),
        };
      }),
    });
  }),
);

matchesRouter.get(
  "/:matchId/messages",
  asyncHandler(async (req, res) => {
    const match = await findMemberMatch(routeParam(req.params.matchId), req.userId!);
    if (!match) {
      throw new HttpError(404, "Match not found");
    }
    const otherId = match.userA.equals(req.userId) ? match.userB.toString() : match.userA.toString();
    if (await isBlockedPair(req.userId!, otherId)) {
      throw new HttpError(403, "This conversation is closed");
    }
    if (match.status === "pending") await assertCanUse(req.userId!, "requestChat");
    else await assertCanUse(req.userId!, "matchChat");
    const query = messageQuerySchema.parse(req.query);
    const readAt = await markIncomingRead(match.id, req.userId!);
    if (readAt) {
      emitToMatch(req.app, match.id, "message:read", { matchId: match.id, readAt });
    }
    const messages = await Message.find({ match: match._id }).sort({ createdAt: -1 }).limit(query.limit);
    const seeReads = await canUse(req.userId!, "readReceipts");
    res.json({
      messages: messages.reverse().map((message) => {
        const item = toMessage(message);
        return seeReads || item.senderId !== req.userId ? item : { ...item, readAt: null };
      }),
    });
  }),
);

matchesRouter.post(
  "/:matchId/messages",
  asyncHandler(async (req, res) => {
    const input = messageSchema.parse(req.body);
    const matchId = routeParam(req.params.matchId);
    const existing = await findMemberMatch(matchId, req.userId!);
    if (!existing) throw new HttpError(404, "Match not found");
    if (existing.status === "pending") await assertCanUse(req.userId!, "requestChat");
    else await assertCanUse(req.userId!, "matchChat");
    const result = await createMessage(matchId, req.userId!, input.text);
    if ("error" in result) {
      throw new HttpError(result.error === "This conversation is closed" ? 403 : 404, result.error ?? "Match not found");
    }
    emitToMatch(req.app, matchId, "message:new", result.message);
    res.status(201).json({ message: result.message });
  }),
);

matchesRouter.delete(
  "/:matchId",
  asyncHandler(async (req, res) => {
    const removed = await removeMatch(routeParam(req.params.matchId), req.userId!);
    if (!removed) throw new HttpError(404, "Match not found");
    res.json({ removed: true });
  }),
);
