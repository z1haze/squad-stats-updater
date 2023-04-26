import knex from 'knex';
import {cloneDeep} from 'lodash';

import config from '../knexfile';
import keys from "../util/keys";
import env from "../util/env";

import {AveragePlayerDeath, Player, PlayerServer} from "../typings/players";
import {Server} from "../typings/server";
import {Death} from "../typings/death";
import {Down} from "../typings/down";
import {Revive} from "../typings/revive";

const db = knex(config);

export default db;

/**
 * Get all servers from the database
 */
export async function getServers() {
  const start = Date.now();

  const servers: Server[] = await db(env.TABLE_SERVERS)
    .select('id')
    .select('name');

  if (env.DEBUG) {
    console.log(`getServers took ${Date.now() - start}ms`);
  }

  return servers;
}

/**
 * Get all players from the database
 */
export async function getPlayers() {
  const start = Date.now();

  const players: Player[] = await db(keys.TABLE_PLAYERS)
    .select('steamID as steamId')
    .select('lastName as name')
    .whereNotNull('lastName');

  if (env.DEBUG) {
    console.log(`getPlayers took ${Date.now() - start}ms`);
  }

  return players;
}

/**
 * Get all deaths from the database
 */
export async function getDeaths() {
  const start = Date.now();

  const deaths: Death[] = await db(keys.TABLE_DEATHS)
    .join(keys.TABLE_MATCHES, `${keys.TABLE_DEATHS}.match`, '=', `${keys.TABLE_MATCHES}.id`)
    .select(`${keys.TABLE_MATCHES}.layer`)
    .select(`${keys.TABLE_DEATHS}.attacker`)
    .select(`${keys.TABLE_DEATHS}.victim`)
    .select(`${keys.TABLE_DEATHS}.teamkill`)
    .select(`${keys.TABLE_DEATHS}.server`)
    .select(`${keys.TABLE_DEATHS}.match`)
    .where(`${keys.TABLE_DEATHS}.server`, '=', 1);

  if (env.DEBUG) {
    console.log(`getDeaths took ${Date.now() - start}ms`);
  }

  return deaths;
}

/**
 * Get the average deaths for every player
 */
export async function getAvgDeathsPerRound() {
  const start = Date.now();

  const res: AveragePlayerDeath[] = await db.with('cte', qb => {
    qb
      .select('d.victim')
      .countDistinct('d.id as total_deaths')
      .countDistinct('m.id as total_matches')
      .from(`${env.TABLE_MATCHES} as m`)
      .leftJoin(`${env.TABLE_DEATHS} as d`, 'd.match', 'm.id')
      .whereNotNull('d.victim')
      .whereNot(function (qb) {
        env.LAYERS_TO_IGNORE.forEach((term) => {
          qb
            .whereILike('m.id', `%${term}%`);
        });
      })
      .groupBy('d.victim');
  })
    .select('victim as steamId')
    .select(db.raw('total_deaths / total_matches as amount')).from('cte');

  if (env.DEBUG) {
    console.log(`getAvgDeathsPerRound took ${Date.now() - start}ms`);
  }

  return res;
}

/**
 * Get all downs from the database
 */
export async function getDowns() {
  const start = Date.now();

  const downs: Down[] = await db(keys.TABLE_DOWNS)
    .join(keys.TABLE_MATCHES, `${keys.TABLE_DOWNS}.match`, '=', `${keys.TABLE_MATCHES}.id`)
    .select(`${keys.TABLE_MATCHES}.layer`)
    .select(`${keys.TABLE_DOWNS}.attacker`)
    .select(`${keys.TABLE_DOWNS}.victim`)
    .select(`${keys.TABLE_DOWNS}.damage`)
    .select(`${keys.TABLE_DOWNS}.server`)
    .select(`${keys.TABLE_DOWNS}.match`)
    .where(`${keys.TABLE_DOWNS}.server`, '=', 1);

  if (env.DEBUG) {
    console.log(`getDowns took ${Date.now() - start}ms`);
  }

  return downs;
}

/**
 * Get all revives from the database
 */
export async function getRevives() {
  const start = Date.now();

  const revives: Revive[] = await db(keys.TABLE_REVIVES)
    .join(keys.TABLE_MATCHES, `${keys.TABLE_REVIVES}.match`, '=', `${keys.TABLE_MATCHES}.id`)
    .select(`${keys.TABLE_MATCHES}.layer`)
    .select(`${keys.TABLE_REVIVES}.reviver`)
    .select(`${keys.TABLE_REVIVES}.victim`)
    .select(`${keys.TABLE_REVIVES}.server`)
    .select(`${keys.TABLE_REVIVES}.match`)
    .where(`${keys.TABLE_REVIVES}.server`, '=', 1);

  if (env.DEBUG) {
    console.log(`getRevives took ${Date.now() - start}ms`);
  }

  return revives;
}

/**
 * Initialize all players as empty stubs
 * @param {Player[]} players
 */
export async function initPlayers(players: Player[]) {
  const start = Date.now();
  const playersMap = new Map();
  const servers = await getServers();

  /**
   * Create a stub for a player on each server
   */
  const playerServerStubs: PlayerServer[] = servers.map((server) => ({
    id: server.id,
    name: server.name,
    downs: 0,
    kills: 0,
    falls: 0,
    deaths: 0,
    revives: 0,
    revived: 0,
    kdr: 0,
    tks: 0,
    tkd: 0,
    rating: 0,
    damage: 0,
    matches: new Set<number>()
  }));

  players.forEach((player) => {
    /**
     * Clone the player stub for each player
     */
    player.servers = cloneDeep(playerServerStubs);

    /**
     * Associate the player record with their steam ID
     */
    playersMap.set(player.steamId, player);
  });

  if (env.DEBUG) {
    console.log(`initPlayers took ${Date.now() - start}ms`);
  }

  return playersMap;
}

