import {getClient} from './lib/redis.js';
import {getDB} from './lib/knex.js';
import {chunk, cloneDeep} from 'lodash-es';
import CONSTANTS from './lib/constants.js';

const db = await getDB();
const redis = await getClient();

/**
 * Get all servers from the database
 *
 * @returns {Promise<Array.<{id: String, name: String}>>}
 */
async function getServers() {
    return db('DBLog_Servers')
        .select('id')
        .select('name');
}

/**
 * Initialize the players map from the database, stubbing out all player's stats
 *
 * @returns {Promise<Map<String, Object.<steamID: String, playerName: String, servers: Array.<{id: String, name: String, kills: Number, deaths: Number, revives: Number, revived: Number, kd: Number, tks: Number, tkd: Number}>>>>}
 */
async function initPlayers() {
    const start = Date.now();
    const playersMap = new Map();

    /**
     * An array of players from the database
     * @type {Array.<{steamID: String, playerName: String}>}
     */
    const players = await db('DBLog_SteamUsers')
        .select('steamID')
        .select('lastName as playerName')
        .whereNotNull('lastName');

    /**
     * Create the empty server stub for each player's stats
     * @type {Array.<{kills: number, name: *, kd: number, id: *, tkd: number, tks: number, deaths: number, revives: number, revived: number}>}
     */
    const servers = (await getServers()).map((server) => ({
        id: server.id, name: server.name, kills: 0, deaths: 0, revives: 0, revived: 0, kd: 0, tks: 0, tkd: 0
    }));

    players.forEach((steamUser) => {
        steamUser.servers = cloneDeep(servers);
        playersMap.set(steamUser.steamID, steamUser);
    });

    console.log(`initPlayers took ${Date.now() - start}ms`);

    return playersMap;
}

/**
 * Get all deaths from the database
 *
 * @returns {Promise<Array.<{attacker: String, victim: String, teamkill: Boolean, server: Number}>>}
 */
async function getDeaths() {
    const start = Date.now();

    const deaths = await db('DBLog_Deaths')
        .select('attacker')
        .select('victim')
        .select('teamkill')
        .select('server');

    console.log(`getDeaths took ${Date.now() - start}ms`);

    return deaths;
}

/**
 * Get all revives from the database
 *
 * @returns {Promise<Array.<{reviver: String, victim: String, server: Number}>>}
 */
async function getRevives() {
    const start = Date.now();

    const revives = await db('DBLog_Revives')
        .select('reviver')
        .select('victim')
        .select('server');

    console.log(`getRevives took ${Date.now() - start}ms`);

    return revives;
}

/**
 * Update the stats for all players in the playersMap
 *
 * @param {Map<String, Object>} playersMap
 * @param {Array.<Object>} deaths
 * @param {Array.<Object>} revives
 * @returns {Promise<Map<String, Object>>}
 */
export async function updatePlayers({playersMap, deaths, revives} = {}) {
    const start = Date.now();

    /**
     * Update each player's deaths, and tks stats
     */
    for (const death of deaths) {
        let attacker = null;
        let victim = null;
        let serverIndex = null

        if (death.attacker) {
            attacker = playersMap.get(death.attacker);
            serverIndex = attacker.servers.findIndex(({id}) => id === death.server);

            if (death.teamkill) {
                attacker.servers[serverIndex].tks++;
            } else {
                attacker.servers[serverIndex].kills++;
            }
        }

        if (death.victim) {
            victim = playersMap.get(death.victim);

            if (!serverIndex) {
                serverIndex = victim.servers.findIndex(({id}) => id === death.server);
            }

            if (death.teamkill) {
                victim.servers[serverIndex].tkd++;
            }

            victim.servers[serverIndex].deaths++;
        }
    }

    /**
     * Update each player's revives stats
     */
    for (const revive of revives) {
        let reviver = null;
        let victim = null;
        let serverIndex = null;

        if (revive.reviver) {
            reviver = playersMap.get(revive.reviver);
            serverIndex = reviver.servers.findIndex(({id}) => id === revive.server);
            reviver.servers[serverIndex].revives++;
        }

        if (revive.victim) {
            victim = playersMap.get(revive.victim);

            if (!serverIndex) {
                serverIndex = victim.servers.findIndex(({id}) => id === revive.server);
            }

            victim.servers[serverIndex].revived++;
        }
    }

    /**
     * Chunk the players map into batches based on the REDIS_BATCH_SIZE in order to batch them to redis in groups
     *
     * @type {Array.<Array.<{steamID: String, playerName: String, servers: Array.<{id: Number, name: String, kills: Number, deaths: Number, revives: Number, revived: Number, kd: Number, tks: Number, tkd: Number}>}>>}
     */
    const playerChunks = chunk(Array.from(playersMap.values()), parseInt(process.env.REDIS_BATCH_SIZE) || 100);

    await Promise.all(
        playerChunks.map(async (players) => {
            const pipeline = redis.pipeline();

            players.forEach((player) => {
                /**
                 * Set the K/D ratio for each player
                 */
                player.servers.map((server) => {
                    if (server.kills === 0) {
                        server.kd = 0;
                    } else {
                        // if they don't have 0 kills, and have 0 deaths, their KD is 1, regardless
                        if (server.deaths === 0) {
                            server.kd = 1;
                        } else {
                            // if they do have kills, and deaths, division calculation to the second digit
                            server.kd = Number(parseFloat(server.kills / server.deaths).toFixed(2));
                        }
                    }
                });

                /**
                 * Aggregate the player's total kills
                 */
                const kills = player.servers.reduce((acc, curr) => acc + curr.kills, 0);

                /**
                 * Aggregate the player's total deaths
                 */
                const deaths = player.servers.reduce((acc, curr) => acc + curr.deaths, 0);

                /**
                 * Aggregate the player's total revives
                 */
                const revives = player.servers.reduce((acc, curr) => acc + curr.revives, 0);

                /**
                 * Store the player in redis
                 */
                pipeline.hset(CONSTANTS.PLAYERS_KEY, player.steamID, JSON.stringify(player));

                /**
                 * Add the player to the kills leaderboard
                 */
                pipeline.zadd(`${CONSTANTS.LEADERBOARD_KEY}:${CONSTANTS.KILLS_KEY}`, kills, player.steamID);

                /**
                 * Add the player to the deaths leaderboard
                 */
                pipeline.zadd(`${CONSTANTS.LEADERBOARD_KEY}:${CONSTANTS.DEATHS_KEY}`, deaths, player.steamID);

                /**
                 * Add the player to the revives leaderboard
                 */
                pipeline.zadd(`${CONSTANTS.LEADERBOARD_KEY}:${CONSTANTS.REVIVES_KEY}`, revives, player.steamID);
            });

            return pipeline.exec();
        })
    );

    // set key for the last time this operation completed
    await redis.set('lastUpdate', Date.now());

    console.log(`updatePlayers took ${Date.now() - start}ms`);

    return playersMap;
}
async function run () {
    const start = Date.now();

    await redis.set('updating', 'true');

    /**
     * A Map of stubbed out players objects
     *
     * @type {Map<String, Object<steamID:String, playerName:String, servers:Array<{id: String, name: String, kills: Number, deaths: Number, revives: Number, revived: Number, kd: Number, tks: Number, tkd: Number}>>>}
     */
    const playersMap = await initPlayers();

    /**
     * An array of deaths from the database
     *
     * @type {Array<{attacker: String, victim: String, teamkill: Boolean, server: Number}>}
     */
    const deaths = await getDeaths();

    /**
     * An array of revives from the database
     *
     * @type {Array<{reviver: String, victim: String, server: Number}>}
     */
    const revives = await getRevives();

    // update all player's stats
    await updatePlayers({playersMap, deaths, revives});

    await redis.del('updating');

    console.log(`finished update after ${Date.now() - start}ms`);
}

setInterval(run, parseInt(process.env.UPDATE_INTERVAL));

await run();