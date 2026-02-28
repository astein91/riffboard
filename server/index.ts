import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { clerkMiddleware, requireAuth } from "@clerk/express";
import { runMigrations } from "./db/migrate.js";
import projectRoutes from "./routes/projects.js";
import gitRoutes from "./routes/git.js";
import distillRoutes from "./routes/distill.js";
import prototypeRoutes from "./routes/prototype.js";
import apiKeysRoutes from "./routes/apiKeys.js";
import preferencesRoutes from "./routes/preferences.js";
import { killOpenCode } from "./services/opencode.js";
import { bridgeToDeepgram } from "./services/deepgram.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || '3456', 10);

// Run DB migrations on startup
runMigrations();

const app = express();

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

// Health check (unauthenticated)
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "riffboard", port: PORT });
});

// All /api routes require auth
app.use("/api/projects", requireAuth(), projectRoutes);
app.use("/api/git", requireAuth(), gitRoutes);
app.use("/api", requireAuth(), distillRoutes);
app.use("/api", requireAuth(), prototypeRoutes);
app.use("/api", requireAuth(), apiKeysRoutes);
app.use("/api/user", requireAuth(), preferencesRoutes);

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // Catch-all route for SPA (serve index.html for any non-API route)
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

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
