import config from '../knexfile.js';
import knex from 'knex';

const knexInstance = knex(config);

export const getDB = async () => knexInstance;