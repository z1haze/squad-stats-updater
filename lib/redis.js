import * as dotenv from 'dotenv';
import Redis from 'ioredis';

dotenv.config();

const  client = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
});

export const getClient = async () => {
    return client;
}