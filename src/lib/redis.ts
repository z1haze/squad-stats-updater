import Redis from "ioredis";
import env from "../util/env";

export default new Redis ({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASS
});