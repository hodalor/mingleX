import type { Server } from "socket.io";
import { verifyToken } from "../utils/tokens.js";
import { isBlockedPair } from "../services/blocks.js";
import { createMessage, markIncomingRead } from "../services/messages.js";
import { findMemberMatch } from "../services/matches.js";

export function registerChatSocket(io: Server): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || token.length === 0) {
      next(new Error("Authentication required"));
      return;
    }
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = String(socket.data.userId ?? "");

    socket.on("match:join", async (matchId: unknown, ack?: (result: unknown) => void) => {
      if (typeof matchId !== "string") {
        ack?.({ ok: false, message: "Match not found" });
        return;
      }
      const match = await findMemberMatch(matchId, userId);
      if (!match) {
        ack?.({ ok: false, message: "Match not found" });
        return;
      }
      const otherId = match.userA.equals(userId) ? match.userB.toString() : match.userA.toString();
      if (await isBlockedPair(userId, otherId)) {
        ack?.({ ok: false, message: "This conversation is closed" });
        return;
      }
      await socket.join(`match:${match.id}`);
      const readAt = await markIncomingRead(match.id, userId);
      if (readAt) {
        io.to(`match:${match.id}`).emit("message:read", { matchId: match.id, readAt });
      }
      ack?.({ ok: true });
    });

    socket.on(
      "message:send",
      async (payload: unknown, ack?: (result: unknown) => void) => {
        const body = payload as { matchId?: unknown; text?: unknown };
        if (typeof body.matchId !== "string" || typeof body.text !== "string") {
          ack?.({ ok: false, message: "Message text is invalid" });
          return;
        }
        const text = body.text.trim();
        if (!text || text.length > 2000) {
          ack?.({ ok: false, message: "Message text is invalid" });
          return;
        }

        const result = await createMessage(body.matchId, userId, text);
        if ("error" in result) {
          ack?.({ ok: false, message: result.error });
          return;
        }

        io.to(`match:${body.matchId}`).emit("message:new", result.message);
        ack?.({ ok: true, message: result.message });
      },
    );
  });
}
