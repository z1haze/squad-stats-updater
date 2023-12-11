import Redis from "ioredis";
import env from "../util/env";

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASS
});

// Listening to the 'connect' event
redis.on('connect', () => {
  console.log('Connected to Redis');
});

// Listening to the 'ready' event
redis.on('ready', () => {
  console.log('Redis is ready to receive commands');
});

// Handle connection error
redis.on('error', (err) => {
  console.error('Error connecting to Redis', err);
});

export default redis;
