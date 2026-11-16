import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { discoverRouter } from "./routes/discover.js";
import { matchesRouter } from "./routes/matches.js";
import { profileRouter } from "./routes/profile.js";
import { reportsRouter } from "./routes/reports.js";
import { blocksRouter } from "./routes/blocks.js";
import { billingRouter } from "./routes/billing.js";
import { featuresRouter } from "./routes/features.js";
import { requestsRouter } from "./routes/requests.js";
import { swipesRouter } from "./routes/swipes.js";
import { uploadRoot } from "./uploads.js";
import { parseOrigins } from "./utils/origins.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: parseOrigins(env.webOrigin, env.adminOrigin),
      credentials: true,
    }),
  );
  app.use(express.json({
  limit: "1mb",
  verify: (req, _res, buf) => {
    (req as { rawBody?: Buffer }).rawBody = buf;
  },
}));
  if (env.nodeEnv !== "production") {
    app.use(morgan("dev"));
  }

  app.use("/uploads", express.static(uploadRoot));

  app.get("/", (_req, res) => {
    res.json({ name: "mingleX API", status: "ok" });
  });
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "minglex-api" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/me", profileRouter);
  app.use("/api/discover", discoverRouter);
  app.use("/api/features", featuresRouter);
app.use("/api/billing", billingRouter);
  app.use("/api/swipes", swipesRouter);
  app.use("/api/requests", requestsRouter);
  app.use("/api/matches", matchesRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/blocks", blocksRouter);
  app.use("/api/admin", adminRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
  });
  app.use(errorHandler);
  return app;
}
