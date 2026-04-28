import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { DurakRoom } from "../src/rooms/DurakRoom";

const appConfig = {
  initializeGameServer: (gameServer: any) => {
    gameServer.define("durak", DurakRoom);
  },
  initializeExpress: (app: any) => {},
};

describe("E2E Durak Match", () => {
  let testingServer: ColyseusTestServer;

  beforeAll(async () => {
    testingServer = await boot(appConfig);
  });

  afterAll(async () => {
    await testingServer.cleanup();
  });

  it("spins up server", () => {
    expect(true).toBe(true);
  });
});
