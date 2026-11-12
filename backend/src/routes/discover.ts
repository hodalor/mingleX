import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Swipe } from "../models/Swipe.js";
import { User } from "../models/User.js";
import { hiddenUserIds } from "../services/blocks.js";
import { distanceKm, needsOnboarding, toPublicProfile, type ProfileSource } from "../serializers/user.js";
import { birthDateBoundsForAges } from "../utils/age.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { discoverQuerySchema } from "../validation/schemas.js";

export const discoverRouter = Router();

discoverRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = discoverQuerySchema.parse(req.query);
    const me = await User.findById(req.userId);
    if (!me) {
      throw new HttpError(401, "Account unavailable");
    }

    const hasLocation = me.location?.coordinates?.length === 2;
    if (needsOnboarding(me) || me.photos.length === 0) {
      res.json({
        profiles: [],
        profileIncomplete: true,
        locationRequired: !hasLocation,
      });
      return;
    }

    const alreadySwiped = await Swipe.find({ from: me._id }).distinct("to");
    const hidden = await hiddenUserIds(me.id);
    const radiusKm = query.radiusKm ?? me.discoveryRadiusKm ?? 100;
    const minAge = me.discoveryMinAge ?? 18;
    const maxAge = me.discoveryMaxAge ?? 80;
    const ages = birthDateBoundsForAges(minAge, maxAge);
    const filter: Record<string, unknown> = {
      _id: { $nin: [me._id, ...alreadySwiped, ...hidden] },
      role: "user",
      isBanned: false,
      "photos.0": { $exists: true },
      interestedIn: me.gender,
      birthDate: { $gt: ages.after, $lte: ages.through },
    };

    if (me.interestedIn.length > 0) {
      filter.gender = { $in: me.interestedIn };
    }

    if (hasLocation) {
      filter.location = {
        $near: {
          $geometry: { type: "Point", coordinates: me.location?.coordinates },
          $maxDistance: radiusKm * 1000,
        },
      };
    }

    const queryBuilder = User.find(filter).limit(query.limit);
    if (!hasLocation) {
      queryBuilder.sort({ lastActiveAt: -1 });
    }

    const people = await queryBuilder;
    const now = Date.now();
    const ranked = [...people].sort((left, right) => {
      const leftBoost = left.boostedUntil && left.boostedUntil.getTime() > now ? 1 : 0;
      const rightBoost = right.boostedUntil && right.boostedUntil.getTime() > now ? 1 : 0;
      return rightBoost - leftBoost;
    });
    const origin = me.location?.coordinates ?? [];
    const profiles = ranked.map((person) => {
      const source = person as unknown as ProfileSource;
      const miles = source.location?.coordinates
        ? distanceKm(origin, source.location.coordinates)
        : undefined;
      return toPublicProfile(source, miles);
    });

    res.json({
      profiles,
      profileIncomplete: false,
      locationRequired: !hasLocation,
    });
  }),
);
