import {describe, it, expect, afterAll} from "@jest/globals";

import redis from "../src/lib/redis";
import {getPlayerServerRating} from "../src/lib/player";
import {PlayerServer} from "../src/typings/players";

const playerServer: PlayerServer = {
  id: 1,
  name: "test",
  downs: 1, // used
  kills: 1, // used
  falls: 1,
  deaths: 1, // used
  revives: 1, // used
  revived: 1,
  kdr: 1,
  idr: 1,
  tks: 1, // used
  tkd: 1, // used
  rating: 1,
  damage: 1,
  matchCount: 1
}

describe("getPlayerServerRating", () => {
  it("should return a number", async () => {
    const rating = getPlayerServerRating({
      ...playerServer,
      kills: 883,
      downs: 1423,
      deaths: 960,
      revives: 244,
      tks: 60,
      tkd: 9
    });

    expect(rating.toFixed(1)).toBe('556.9');
  });
});

afterAll(async () => {
  await redis.quit();
});