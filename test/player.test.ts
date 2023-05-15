import {describe, it, expect, afterAll} from "@jest/globals";

import redis from "../src/lib/redis";
import {getPlayerServerRating, addIncap, addDeath, addRevive} from "../src/lib/player";
import {Player, PlayerServer} from "../src/typings/players";

const playerServer: PlayerServer = {
  id: 1,
  name: "test",
  incaps: 0, // used
  kills: 0, // used
  falls: 0, // used
  deaths: 0, // used
  revives: 0, // used
  revived: 0,
  kdr: 0,
  idr: 0,
  tks: 0, // used
  tkd: 0, // used
  rating: 0,
  damage: 0,
  matchCount: 0,
  ke: 0,
  de: 0
}

describe("Player Ratings", () => {
  it("A player rating should be valid", async () => {
    const rating = getPlayerServerRating({
      ...playerServer,
      kills: 2500,
      incaps: 3000,
      deaths: 1400,
      revives: 750,
      falls: 2000,
      tks: 30,
      tkd: 0
    });

    expect(rating.toFixed(1)).toBe('635.1');
  });
});

describe("Player Stats Updates", () => {
  const attacker = {
    steamId: '1',
    name: 'attacker',
    servers: [playerServer]
  };

  const victim = {
    ...attacker,
    steamId: '2',
    name: 'victim'
  };

  const playerMap = new Map([
    [attacker.steamId, attacker],
    [victim.steamId, victim],
  ]);

  it("An incap should be added for an attacker, and a fall should be added for a victim", () => {
    addIncap(
      playerMap,
      {
        attacker: attacker.steamId,
        victim: victim.steamId,
        teamkill: false,
        server: playerServer.id,
        layer: 'test',
        match: 1
      }
    );

    if (attacker?.servers && victim?.servers) {
      expect(attacker.servers[0].incaps).toBe(1);
      expect(victim?.servers[0].falls).toBe(1);
    }
  });

  it("A kill should be added for an attacker, and a death should be added for a victim", () => {
    addDeath(
      playerMap,
      {
        attacker: attacker.steamId,
        victim: victim.steamId,
        teamkill: false,
        server: playerServer.id,
        layer: 'test',
        match: 1
      }
    );

    if (attacker?.servers && victim?.servers) {
      expect(attacker.servers[0].kills).toBe(1);
      expect(victim?.servers[0].deaths).toBe(1);
    }
  });

  it("A teamkill should be added for an attacker and a teamkilled should be added for a victim", () => {
    addDeath(
      playerMap,
      {
        attacker: attacker.steamId,
        victim: victim.steamId,
        teamkill: true,
        server: playerServer.id,
        layer: 'test',
        match: 1
      }
    );

    if (attacker?.servers && victim?.servers) {
      expect(attacker.servers[0].tks).toBe(1);
      expect(victim?.servers[0].tkd).toBe(1);
    }
  });

  it("A revive should be added for a reviver and a revived should be added for a victim", () => {
    addRevive(
      playerMap,
      {
        reviver: attacker.steamId,
        victim: victim.steamId,
        server: playerServer.id,
        layer: 'test',
        match: 1
      }
    );

    if (attacker?.servers && victim?.servers) {
      expect(attacker.servers[0].revives).toBe(1);
      expect(victim?.servers[0].revived).toBe(1);
    }
  });
});

afterAll(async () => {
  await redis.quit();
});