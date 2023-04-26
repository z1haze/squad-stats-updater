import {Player, PlayerServer, UpdatePlayersOptions} from "../typings/players";
import {chunk} from "lodash";
import env from "../util/env";
import redis from "./redis";
import keys from "../util/keys";
import {shouldIgnoreLayer} from "../util/helpers";
import {Death} from "../typings/death";
import {Down} from "../typings/down";
import {Revive} from "../typings/revive";

/**
 *
 * @param {Map<string, Player>} playersMap
 * @param {Death[]} deaths
 * @param {Down[]} downs
 * @param {Revive[]} revives
 */
export async function updatePlayers({playersMap, deaths, downs, revives}: UpdatePlayersOptions) {
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
  for (const down of downs) {
    // only add down that we want to track
    if (!down.layer || shouldIgnoreLayer(down.layer)) {
      continue;
    }

    // only add downs that have both an attacker and a victim
    if (!down.attacker || !down.victim) {
      continue;
    }

    addDown(playersMap, down)
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
         * Set the K/D ratio for each player
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
              server.kdr = parseFloat((server.kills / server.deaths).toFixed(1));
            }
          }

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
          // Add player to ratings leaderboard
          const rating = player.servers.reduce((acc, curr) => acc + curr.rating, 0) / player.servers.length;
          pipeline.zadd(`${keys.LEADERBOARD}:${keys.RATING}`, rating, player.steamId);

          // Add player to kills leaderboard
          const kills = player.servers.reduce((acc, curr) => acc + curr.kills, 0);
          pipeline.zadd(`${keys.LEADERBOARD}:${keys.KILLS}`, kills, player.steamId);

          // Add player to revives leaderboard
          const revives = player.servers.reduce((acc, curr) => acc + curr.revives, 0);
          pipeline.zadd(`${keys.LEADERBOARD}:${keys.REVIVES}`, revives, player.steamId);
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
   * each action. E.G. how much is a "kill" worth compared to a "down",
   * compared to a "revive", compared to a "tk", etc.
   */
  const killFactor = 1;
  const downFactor = .5;
  const deathFactor = 1;
  const reviveFactor = .5;
  const tkdFactor = 1;
  const tkFactor = .5;

  const contributionThreshold = 750;

  // uses log10 for now until we figure out how change the base
  // const maxScoringRatio = 10;

  /**
   * The "punishment" multiple for players who have not met the contribution threshold.
   * E.G. until a player has contributed at least a score of 400, their score is reduced
   * by a factor of how far they are away from meeting that threshold
   *
   * @type {number}
   */
  const falloff = Math.min(contributionThreshold, (playerServer.kills + playerServer.revives)) / contributionThreshold;

  /**
   * The top half of the big goofy fraction
   *
   * @type {number}
   */
  const top = killFactor * playerServer.kills + downFactor * (playerServer.downs - playerServer.kills) + reviveFactor * playerServer.revives;

  /**
   * The bottom half of the big goofy fraction
   *
   * @type {number}
   */
  const bottom = deathFactor * (playerServer.deaths - tkdFactor * playerServer.tkd) + tkFactor * playerServer.tks;

  /**
   * The main calculation for determining score based on logarithmic ratio of positive to negative contributions
   */
  const contributionFactor = Math.min(2, Math.log10(top / bottom) + 1);

  const finalScore = 500 * falloff * contributionFactor;

  return finalScore < 0 ? 0 : finalScore;
}

/**
 * Associate the provided death object with the respective player's stats
 *
 * @param playersMap
 * @param death
 */
function addDeath(playersMap: Map<string, Player>, death: Death) {
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
 * Associate the provided down object with the respective player's stats
 *
 * @param playersMap
 * @param down
 */
function addDown(playersMap: Map<string, Player>, down: Down) {
  let serverIndex = null;

  const attacker = playersMap.get(down.attacker);

  if (attacker?.servers) {
    serverIndex = attacker.servers.findIndex(({id}) => id === down.server);

    attacker.servers[serverIndex].matches?.add(down.match);

    if (!down.teamkill) {
      attacker.servers[serverIndex].downs++;
    }
  }

  const victim = playersMap.get(down.victim);

  if (victim?.servers) {
    if (!serverIndex) {
      serverIndex = victim.servers.findIndex(({id}) => id === down.server);
    }

    victim.servers[serverIndex].matches?.add(down.match);
    victim.servers[serverIndex].falls++;
  }
}

/**
 * Associate the provided revive object with the respective player's stats
 *
 * @param playersMap
 * @param revive
 */
function addRevive(playersMap: Map<string, Player>, revive: Revive) {
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