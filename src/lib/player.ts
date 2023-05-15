import {Player, PlayerServer, UpdatePlayersOptions} from "../typings/players";
import {chunk} from "lodash";
import env from "../util/env";
import redis from "./redis";
import keys from "../util/keys";
import {shouldIgnoreLayer} from "../util/helpers";
import {Death} from "../typings/death";
import {Incap} from "../typings/incap";
import {Revive} from "../typings/revive";

/**
 *
 * @param {Map<string, Player>} playersMap
 * @param {Death[]} deaths
 * @param {Incap[]} incaps
 * @param {Revive[]} revives
 */
export async function updatePlayers({playersMap, deaths, incaps, revives}: UpdatePlayersOptions) {
  const start = Date.now();

  /**
   * Associate each death with a player (victim and attacker)
   */
  for (const death of deaths) {
    // only add deaths that we want to track
    if (!death.layer || shouldIgnoreLayer(death.layer)) {
      continue;
    }

    // only add deaths that have both an attacker and a victim
    if (!death.attacker || !death.victim) {
      continue;
    }

    addDeath(playersMap, death);
  }

  /**
   * Update each player's deaths, and tks stats
   */
  for (const incap of incaps) {
    // only add incap that we want to track
    if (!incap.layer || shouldIgnoreLayer(incap.layer)) {
      continue;
    }

    // only add incaps that have both an attacker and a victim
    if (!incap.attacker || !incap.victim) {
      continue;
    }

    addIncap(playersMap, incap)
  }

  /**
   * Update each player's revives stats
   */
  for (const revive of revives) {
    // only add revives that we want to track
    if (!revive.layer || shouldIgnoreLayer(revive.layer)) {
      continue;
    }

    // only add revives that have both a reviver and a victim
    if (!revive.reviver || !revive.victim) {
      continue;
    }

    addRevive(playersMap, revive);
  }


  const playerChunks = chunk(Array.from(playersMap.values()), env.REDIS_BATCH_SIZE);

  await Promise.all(
    playerChunks.map(async (players) => {
      const pipeline = redis.pipeline();

      players.forEach((player) => {
        /**
         * Set the K/D, I/D ratios for each player
         */
        player.servers?.map((server) => {
          if (server.kills === 0) {
            server.kdr = 0;
          } else {
            // if they don't have 0 kills, and have 0 deaths, their KD is 1, regardless
            if (server.deaths === 0) {
              server.kdr = 1;
            } else {
              // if they do have kills, and deaths, division calculation to the second digit
              server.kdr = parseFloat((server.kills / (server.deaths - server.tkd)).toFixed(1));
            }
          }

          if (server.incaps === 0) {
            server.idr = 0;
          } else {
            // if they don't have 0 kills, and have 0 deaths, their KD is 1, regardless
            if (server.deaths === 0) {
              server.idr = 1;
            } else {
              // if they do have kills, and deaths, division calculation to the second digit
              server.idr = parseFloat((server.incaps / (server.deaths - server.tkd)).toFixed(1));
            }
          }

          // kill efficiency (how often an incap results in a kill)
          server.ke = Math.min(server.kills / server.incaps, 1);

          // death efficiency (how often a fall results in a death)
          server.de = Math.min((server.deaths - server.tkd) / server.falls, 1);

          // we're done
          server.rating = getPlayerServerRating(server);

          if (server.matches) {
            server.matchCount = server.matches.size;

            delete server.matches;
          }
        });

        // Add player to redis
        pipeline.hset(keys.STATS, player.steamId, JSON.stringify(player));

        if (player.servers) {
          // Add player to matches played leaderboard
          const matches = player.servers.reduce((acc, curr) => acc + (curr?.matchCount || 0), 0);

          if (matches >= env.MATCHES_MINIMUM) {
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.MATCHES}`, matches, player.steamId);

            // Add player to ratings leaderboard
            const rating = player.servers.reduce((acc, curr) => acc + curr.rating, 0) / player.servers.length;
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.RATING}`, rating, player.steamId);

            // Add player to kills leaderboard
            const kills = player.servers.reduce((acc, curr) => acc + curr.kills, 0);
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.KILLS}`, kills, player.steamId);

            // Add player to deaths leaderboard
            const deaths = player.servers.reduce((acc, curr) => acc + curr.deaths, 0);
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.DEATHS}`, deaths, player.steamId);

            // Add player to incaps leaderboard
            const incaps = player.servers.reduce((acc, curr) => acc + curr.incaps, 0);
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.INCAPS}`, incaps, player.steamId);

            // Add player to kill efficiency leaderboard
            const ke = player.servers.reduce((acc, curr) => acc + curr.ke, 0) / player.servers.length;
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.KILL_EFFICIENCY}`, ke, player.steamId);

            // Add player to falls leaderboard
            const falls = player.servers.reduce((acc, curr) => acc + curr.falls, 0);
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.FALLS}`, falls, player.steamId);

            // Add player to death efficiency leaderboard
            const de = player.servers.reduce((acc, curr) => acc + curr.de, 0) / player.servers.length;
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.DEATH_EFFICIENCY}`, de, player.steamId);

            // Add player to revives leaderboard
            const revives = player.servers.reduce((acc, curr) => acc + curr.revives, 0);
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.REVIVES}`, revives, player.steamId);

            // Add player to revives leaderboard
            const revived = player.servers.reduce((acc, curr) => acc + curr.revived, 0);
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.REVIVED}`, revived, player.steamId);

            // Add player to k/d leaderboard
            const kdr = player.servers.reduce((acc, curr) => acc + curr.kdr, 0) / player.servers.length;
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.KDR}`, kdr, player.steamId);

            // Add player to i/d leaderboard
            const idr = player.servers.reduce((acc, curr) => acc + curr.idr, 0) / player.servers.length;
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.IDR}`, idr, player.steamId);

            // Add player to tks leaderboard
            const tks = player.servers.reduce((acc, curr) => acc + curr.tks, 0);
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.TKS}`, tks, player.steamId);

            // Add player to tkd leaderboard
            const tkd = player.servers.reduce((acc, curr) => acc + curr.tkd, 0);
            pipeline.zadd(`${keys.LEADERBOARD}:${keys.TKD}`, tkd, player.steamId);
          }
        }
      });

      return pipeline.exec();
    })
  );

  // set key for the last time this operation completed
  await redis.set('lastUpdate', Date.now());

  if (env.DEBUG) {
    console.log(`updatePlayers took ${Date.now() - start}ms`);
  }

  return playersMap;
}

/**
 * Calculate the 'rating' of an individual player based on their overall contributions
 *
 * A HUGE thank you to _0_ZERO_0_ https://github.com/TT-ZERO for coming up with this!
 *
 * @param {PlayerServer} playerServer
 */
export function getPlayerServerRating(playerServer: PlayerServer) {
  /**
   * players who have less than 1 death after subtracting times they've been team killed have a score of 0
   */
  if (playerServer.deaths - playerServer.tkd <= 0) {
    return 0;
  }

  /**
   * The following variables denote the "weighting factor" for
   * each action. E.G. how much is a "kill" worth compared to an "incap",
   * compared to a "revive", compared to a "tk", etc.
   */
  const killFactor = .9;
  const incapFactor = .6;
  const deathFactor = 1;
  const reviveFactor = 1;
  const fallFactor = .3;
  const tkFactor = .5;

  const contributionThreshold = 4000;

  // uses log10 for now until we figure out how change the base
  // const maxScoringRatio = 10;

  /**
   * The "punishment" multiple for players who have not met the contribution threshold.
   * E.G. until a player has contributed at least a score of 400, their score is reduced
   * by a factor of how far they are away from meeting that threshold
   *
   * @type {number}
   */
  const falloff = Math.min(logBase((killFactor * playerServer.kills + reviveFactor + playerServer.revives), contributionThreshold), 1);

  /**
   * The top half of the big goofy fraction
   *
   * @type {number}
   */
  const top = Math.max(killFactor * playerServer.kills + incapFactor * (playerServer.incaps - playerServer.kills) + reviveFactor * playerServer.revives, 1);

  /**
   * The bottom half of the big goofy fraction
   *
   * @type {number}
   */
  const bottom = Math.max(deathFactor * (playerServer.deaths - playerServer.tkd) + fallFactor * (playerServer.falls - (playerServer.deaths - playerServer.tkd)) + tkFactor * playerServer.tks, 1);

  /**
   * The main calculation for determining score based on logarithmic ratio of positive to negative contributions
   */
  const contributionFactor = Math.min(2, Math.log10(top / bottom) + 1);

  const finalScore = 500 * falloff * contributionFactor;

  return finalScore < 0 ? 0 : finalScore;
}

function logBase(n: number, base: number) {
  return Math.log(n) / Math.log(base);
}

/**
 * Associate the provided death object with the respective player's stats
 *
 * @param playersMap
 * @param death
 */
export function addDeath(playersMap: Map<string, Player>, death: Death) {
  let serverIndex = null;

  const attacker = playersMap.get(death.attacker);

  if (attacker?.servers) {
    serverIndex = attacker.servers.findIndex(({id}) => id === death.server);

    attacker.servers[serverIndex].matches?.add(death.match);

    if (death.teamkill) {
      attacker.servers[serverIndex].tks++;
    } else {
      attacker.servers[serverIndex].kills++;
    }
  }

  const victim = playersMap.get(death.victim);

  if (victim?.servers) {
    if (!serverIndex) {
      serverIndex = victim.servers.findIndex(({id}) => id === death.server);
    }

    victim.servers[serverIndex].matches?.add(death.match);

    if (death.teamkill) {
      victim.servers[serverIndex].tkd++;
    }

    victim.servers[serverIndex].deaths++;
  }
}

/**
 * Associate the provided incap object with the respective player's stats
 *
 * @param playersMap
 * @param incap
 */
export function addIncap(playersMap: Map<string, Player>, incap: Incap) {
  let serverIndex = null;

  const attacker = playersMap.get(incap.attacker);

  if (attacker?.servers) {
    serverIndex = attacker.servers.findIndex(({id}) => id === incap.server);

    attacker.servers[serverIndex].matches?.add(incap.match);

    if (!incap.teamkill) {
      attacker.servers[serverIndex].incaps++;
    }
  }

  const victim = playersMap.get(incap.victim);

  if (victim?.servers) {
    if (!serverIndex) {
      serverIndex = victim.servers.findIndex(({id}) => id === incap.server);
    }

    victim.servers[serverIndex].matches?.add(incap.match);
    victim.servers[serverIndex].falls++;
  }
}

/**
 * Associate the provided revive object with the respective player's stats
 *
 * @param playersMap
 * @param revive
 */
export function addRevive(playersMap: Map<string, Player>, revive: Revive) {
  let serverIndex = null;

  const reviver = playersMap.get(revive.reviver);

  if (reviver && reviver.servers) {
    serverIndex = reviver.servers.findIndex(({id}) => id === revive.server);

    reviver.servers[serverIndex].matches?.add(revive.match);
    reviver.servers[serverIndex].revives++;
  }

  const victim = playersMap.get(revive.victim);

  if (victim && victim.servers) {
    if (!serverIndex) {
      serverIndex = victim.servers.findIndex(({id}) => id === revive.server);
    }

    victim.servers[serverIndex].matches?.add(revive.match);
    victim.servers[serverIndex].revived++;
  }
}