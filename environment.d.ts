declare global {
    namespace NodeJS {
        interface ProcessEnv {
            DB_HOST: string;
            DB_PORT: string;
            DB_USER: string;
            DB_PASS: string;
            DB_NAME: string;

            REDIS_HOST: string;
            REDIS_PORT: string;
            REDIS_PASS: string;

            UPDATE_INTERVAL: string;
            REDIS_BATCH_SIZE: string;

            TABLE_DEATHS: string;
            TABLE_REVIVES: string;
            TABLE_DOWNS: string;
            TABLE_PLAYERS: string;
            TABLE_SERVERS: string;
            TABLE_MATCHES: string;
            LAYERS_TO_IGNORE: string;
        }
    }
}

export {}