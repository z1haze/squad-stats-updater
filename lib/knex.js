import config from '../knexfile.js';
import knex from 'knex';

const knexInstance = knex(config[process.env.NODE_ENV]);

export const getDB = async () => knexInstance;