import {chunk} from 'lodash';

import {getDeaths, getDowns, getPlayers, getRevives, initPlayers} from "./lib/knex";
import {updatePlayers} from "./lib/player";
import redis from "./lib/redis";
import env from "./util/env";
import keys from "./util/keys";

async function update () {
    const start = new Date();

    await redis.set('updating', 'true');

    const players = await getPlayers();

    // Redis recommends limiting pipelines groups of 100
    const playerChunks = chunk(players, env.REDIS_BATCH_SIZE);

    // store players in redis with their username as the key and Steam ID as the value so that we can use HSCAN for user searching
    await Promise.all(
        playerChunks.map(async (players) => {
            const pipeline = redis.pipeline();

            players.forEach((player) => {
                pipeline.hset(keys.PLAYERS, player.name, player.steamId);
            });

            return pipeline.exec();
        })
    );

    /**
     * A Map of stubbed out players objects
     */
    const playersMap = await initPlayers(players);

    /**
     * An array of downs from the database
     */
    const downs = await getDowns();

    /**
     * An array of deaths from the database
     */
    const deaths = await getDeaths();

    /**
     * An array of revives from the database
     */
    const revives = await getRevives();


    await updatePlayers({playersMap, deaths, downs, revives});
    await redis.del('updating');

    console.log(`Stats sync started at ${start.toLocaleTimeString()} and took ${Date.now() - start.getTime()}ms`);
}

(async() => {
    await redis.flushall();

    setInterval(update, env.UPDATE_INTERVAL);

    await update();
})()