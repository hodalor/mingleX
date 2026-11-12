import type { Application } from "express";
import type { Server } from "socket.io";

export function emitToMatch(app: Application, matchId: string, event: string, payload: unknown): void {
  const io = app.get("io") as Server | undefined;
  io?.to(`match:${matchId}`).emit(event, payload);
}
