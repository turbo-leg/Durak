import { Server, Room } from "colyseus";
import express from "express";
import http from "http";
import cors from "cors";

// A dummy room to prevent Colyseus boot errors
class DummyRoom extends Room {
  onCreate() {
    console.log("DummyRoom created!");
  }
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const gameServer = new Server({
  server,
});

gameServer.define('dummy', DummyRoom);

const port = Number(process.env.PORT || 2567);
gameServer.listen(port).then(() => {
  console.log(`🎮 Game server is listening on port ${port}`);
});
