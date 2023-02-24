import env from "./util/env";

export default {
    client    : 'mysql2',
    connection: {
        host    : env.DB_HOST,
        port    : env.DB_PORT,
        user    : env.DB_USER,
        password: env.DB_PASS,
        database: env.DB_NAME
    },
    pool: {
        min: 2,
        max: 10
    }
};