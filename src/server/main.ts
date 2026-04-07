import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { createServer } from "http";
import { SamuraiJamRoom } from "./rooms/SamuraiJamRoom.js";

const app = express();
const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("samurai_jam", SamuraiJamRoom);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = parseInt(process.env.PORT || "2567", 10);
gameServer.listen(port).then(() => {
  console.log(`[SamuraiJam] Server listening on ws://localhost:${port}`);
});
