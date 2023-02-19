import * as dotenv from 'dotenv';

dotenv.config();

const config = {
    // debug: true,
    client    : 'mysql2',
    connection: {
        host    : process.env.DB_HOST,
        port    : process.env.DB_PORT,
        user    : process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    },
    pool: {
        min: 2,
        max: 10
    }
};

export default {
    development: config
};