import {describe, it, expect, afterAll} from "@jest/globals";

import redis from "../src/lib/redis";
import {getPlayerServerRating} from "../src/lib/player";
import {PlayerServer} from "../src/typings/players";

const playerServer: PlayerServer = {
  id: 1,
  name: "test",
  downs: 1, // used
  kills: 1, // used
  falls: 1, // used
  deaths: 1, // used
  revives: 1, // used
  revived: 1,
  kdr: 1,
  idr: 1,
  tks: 1, // used
  tkd: 1,
  rating: 1,
  damage: 1,
  matchCount: 1,
  ke: 0,
  de: 0
}

describe("getPlayerServerRating", () => {
  it("should provide a valid rating", async () => {
    const rating = getPlayerServerRating({
      ...playerServer,
      kills: 2500,
      downs: 3000,
      deaths: 1400,
      revives: 750,
      falls: 2000,
      tks: 30,
    });

    expect(rating.toFixed(1)).toBe('635.1');
  });
});

afterAll(async () => {
  await redis.quit();
});