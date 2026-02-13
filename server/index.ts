import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import projectRoutes from "./routes/projects.js";
import gitRoutes from "./routes/git.js";
import distillRoutes from "./routes/distill.js";
import { killOpenCode } from "./services/opencode.js";
import { bridgeToDeepgram } from "./services/deepgram.js";

const PORT = 3456;

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/projects", projectRoutes);
app.use("/api/git", gitRoutes);
app.use("/api", distillRoutes);

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws/transcribe" });
wss.on("connection", (ws) => {
  console.log("[ws] browser connected to /ws/transcribe");
  const bridge = bridgeToDeepgram(ws, (errMsg) => {
    // Defer so the browser has time to attach onmessage before we send + close
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "Error", message: errMsg }));
      }
      setTimeout(() => ws.close(), 100);
    }, 50);
  });
  ws.on("close", () => {
    console.log("[ws] browser disconnected");
    bridge?.cleanup();
  });
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});

function shutdown(): void {
  console.log("[server] shutting down...");
  killOpenCode();
  // Terminate all WebSocket clients immediately so the HTTP server can close
  for (const client of wss.clients) {
    client.terminate();
  }
  wss.close();
  server.closeAllConnections();
  server.close(() => process.exit(0));
  // Force exit quickly so tsx watch can restart without EADDRINUSE
  setTimeout(() => process.exit(0), 300);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
