import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { registerChatSocket } from "./socket/chat.js";

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [env.webOrigin, env.adminOrigin],
    credentials: true,
  },
});

registerChatSocket(io);
app.set("io", io);

try {
  await connectDb();
  server.listen(env.port, "0.0.0.0", () => {
    console.log(`mingleX API listening on http://localhost:${env.port}`);
  });
} catch (error) {
  console.error("Failed to start mingleX API");
  console.error(error);
  process.exit(1);
}
