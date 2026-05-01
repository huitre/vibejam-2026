import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { createServer } from "http";
import { fileURLToPath } from "url";
import path from "path";
import { SamuraiJamRoom } from "./rooms/SamuraiJamRoom.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("samurai_jam", SamuraiJamRoom);

// Serve static client build in production
const clientDir = path.join(__dirname, "../client");
app.use("/samuraijam", express.static(clientDir));
app.get("/samuraijam/*", (_req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = parseInt(process.env.PORT || "2567", 10);
gameServer.listen(port).then(() => {
  console.log(`[SamuraiJam] Server listening on ws://localhost:${port}`);
});
