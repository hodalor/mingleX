import { Router } from "express";
import mongoose from "mongoose";
import { Match } from "../models/Match.js";
import { Report } from "../models/Report.js";
import { Block } from "../models/Block.js";
import { User } from "../models/User.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { toAdminUser, type AccountSource } from "../serializers/user.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { routeParam } from "../utils/params.js";
import { banSchema, paidAccessSchema, reportStatusSchema, serviceFlagsSchema } from "../validation/schemas.js";
import { paymentFlags, savePaymentFlags, serviceCatalog } from "../services/billing.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

const pageSize = 8;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function listWindow(value: unknown, total: number) {
  const parsed = typeof value === "string" ? Number(value) : 1;
  const requested = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requested, pages);
  return { page, pageSize, skip: (page - 1) * pageSize, pages };
}

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [users, matches, openReports, bannedUsers, blocks] = await Promise.all([
      User.countDocuments({ role: "user" }),
      Match.countDocuments({ status: { $ne: "pending" } }),
      Report.countDocuments({ status: "open" }),
      User.countDocuments({ isBanned: true }),
      Block.countDocuments(),
    ]);
    res.json({ users, matches, openReports, bannedUsers, blocks });
  }),
);

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const banned = typeof req.query.banned === "string" ? req.query.banned : "";
    const filter: Record<string, unknown> = { role: "user" };
    if (search) {
      filter.$or = [
        { email: new RegExp(escapeRegex(search), "i") },
        { name: new RegExp(escapeRegex(search), "i") },
      ];
    }
    if (banned === "true" || banned === "false") {
      filter.isBanned = banned === "true";
    }
    const total = await User.countDocuments(filter);
    const window = listWindow(req.query.page, total);
    const users = await User.find(filter).sort({ createdAt: -1 }).skip(window.skip).limit(pageSize);
    res.json({
      total,
      page: window.page,
      pageSize,
      users: users.map((user) => toAdminUser(user as unknown as AccountSource)),
    });
  }),
);

adminRouter.patch(
  "/users/:id/ban",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Invalid user id");
    }
    const input = banSchema.parse(req.body);
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    if (user.role === "admin") {
      throw new HttpError(400, "Admin accounts cannot be banned here");
    }

    user.isBanned = input.banned;
    user.banReason = input.banned ? input.reason ?? "" : "";
    await user.save();
    res.json({ user: toAdminUser(user as unknown as AccountSource) });
  }),
);

adminRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" && req.query.status !== "all" ? req.query.status : undefined;
    const filter = status ? { status } : {};
    const total = await Report.countDocuments(filter);
    const window = listWindow(req.query.page, total);
    const reports = await Report.find(filter).sort({ createdAt: -1 }).skip(window.skip).limit(pageSize).populate("reporter reportedUser");
    res.json({
      total,
      page: window.page,
      pageSize,
      reports: reports.map((report) => ({
        id: report.id,
        reason: report.reason,
        details: report.details,
        status: report.status,
        createdAt: report.createdAt,
        reporter: summarize(report.reporter),
        reportedUser: summarize(report.reportedUser),
      })),
    });
  }),
);

adminRouter.patch(
  "/reports/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, "Invalid report id");
    }
    const input = reportStatusSchema.parse(req.body);
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: input.status },
      { new: true },
    );
    if (!report) {
      throw new HttpError(404, "Report not found");
    }
    res.json({ report: { id: report.id, status: report.status } });
  }),
);

adminRouter.get(
  "/matches",
  asyncHandler(async (req, res) => {
    const filter = { status: { $ne: "pending" } };
    const total = await Match.countDocuments(filter);
    const window = listWindow(req.query.page, total);
    const matches = await Match.find(filter).sort({ createdAt: -1 }).skip(window.skip).limit(pageSize).populate("userA userB");
    res.json({
      total,
      page: window.page,
      pageSize,
      matches: matches.map((match) => ({
        id: match.id,
        matchedAt: match.createdAt,
        lastMessageAt: match.lastMessageAt ?? null,
        userA: summarize(match.userA),
        userB: summarize(match.userB),
      })),
    });
  }),
);

adminRouter.get(
  "/blocks",
  asyncHandler(async (req, res) => {
    const total = await Block.countDocuments();
    const window = listWindow(req.query.page, total);
    const blocks = await Block.find().sort({ createdAt: -1 }).skip(window.skip).limit(pageSize).populate("blocker blocked");
    res.json({
      total,
      page: window.page,
      pageSize,
      blocks: blocks.map((block) => ({
        id: block.id,
        createdAt: block.createdAt,
        blocker: summarize(block.blocker),
        blocked: summarize(block.blocked),
      })),
    });
  }),
);

adminRouter.get(
  "/services",
  asyncHandler(async (_req, res) => {
    const flags = await paymentFlags();
    res.json({
      services: serviceCatalog.map((item) => ({ ...item, requiresPayment: flags[item.id] })),
    });
  }),
);

adminRouter.patch(
  "/services",
  asyncHandler(async (req, res) => {
    const flags = await savePaymentFlags(serviceFlagsSchema.parse(req.body));
    res.json({
      services: serviceCatalog.map((item) => ({ ...item, requiresPayment: flags[item.id] })),
    });
  }),
);

adminRouter.patch(
  "/users/:id/access",
  asyncHandler(async (req, res) => {
    const input = paidAccessSchema.parse(req.body);
    const userId = routeParam(req.params.id);
    if (!mongoose.isValidObjectId(userId)) throw new HttpError(400, "Invalid user id");
    const user = await User.findOneAndUpdate(
      { _id: userId, role: "user" },
      { $set: { paidAccess: input.paidAccess } },
      { new: true },
    );
    if (!user) throw new HttpError(404, "Member not found");
    res.json({ user: toAdminUser(user as unknown as AccountSource) });
  }),
);

function summarize(value: unknown) {
  if (!value || typeof value !== "object" || !("_id" in value)) {
    return null;
  }
  const user = value as { _id: { toString(): string }; name?: string; email?: string };
  return {
    id: user._id.toString(),
    name: user.name ?? "",
    email: user.email ?? "",
  };
}
