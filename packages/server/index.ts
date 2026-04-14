import { Server } from "colyseus";
import express from "express";
import http from "http";
import cors from "cors";
import { monitor } from "@colyseus/monitor";

import { DurakRoom } from "./src/rooms/DurakRoom";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const gameServer = new Server({
  server,
});

// Register the Durak game room
gameServer.define('durak', DurakRoom);

// Add colyseus monitor for debugging
app.use("/colyseus", monitor());

const port = Number(process.env.PORT || 2567);
gameServer.listen(port).then(() => {
  console.log(`🎮 Durak Game server is listening on port ${port}`);
});
