import { Router } from "express";
import mongoose from "mongoose";
import { Report } from "../models/Report.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { blockUser } from "../services/blocks.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { reportSchema } from "../validation/schemas.js";

export const reportsRouter = Router();

reportsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = reportSchema.parse(req.body);
    if (!mongoose.isValidObjectId(input.reportedUserId)) {
      throw new HttpError(400, "Invalid user id");
    }
    if (input.reportedUserId === req.userId) {
      throw new HttpError(400, "You cannot report yourself");
    }

    const reported = await User.findById(input.reportedUserId).select("_id");
    if (!reported) {
      throw new HttpError(404, "Profile not found");
    }

    const report = await Report.create({
      reporter: req.userId,
      reportedUser: reported._id,
      reason: input.reason,
      details: input.details ?? "",
    });
    await blockUser(req.userId!, reported.id);

    res.status(201).json({
      report: {
        id: report.id,
        reason: report.reason,
        status: report.status,
      },
    });
  }),
);
