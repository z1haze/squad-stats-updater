require('dotenv').config();

export default {
  DEBUG: process.env.DEBUG === 'true',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : null,
  DB_USER: process.env.DB_USER || '',
  DB_PASS: process.env.DB_PASS || '',
  DB_NAME: process.env.DB_NAME || '',

  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  REDIS_PASS: process.env.REDIS_PASS,

  REDIS_BATCH_SIZE: process.env.REDIS_BATCH_SIZE ? parseInt(process.env.REDIS_BATCH_SIZE) : 100,

  TABLE_DEATHS: process.env.TABLE_DEATHS || '',
  TABLE_REVIVES: process.env.TABLE_REVIVES || '',
  TABLE_DOWNS: process.env.TABLE_DOWNS || '',
  TABLE_PLAYERS: process.env.TABLE_PLAYERS || '',
  TABLE_SERVERS: process.env.TABLE_SERVERS || '',
  TABLE_MATCHES: process.env.TABLE_MATCHES || '',

  SEASON_START: process.env.SEASON_START || '1970-01-01T00:00:00Z',

  MATCHES_MINIMUM: process.env.MATCHES_MINIMUM ? parseInt(process.env.MATCHES_MINIMUM) : 10,

  LAYERS_TO_IGNORE: process.env.LAYERS_TO_IGNORE ? process.env.LAYERS_TO_IGNORE.split(',') : [],

  UPDATE_INTERVAL: process.env.UPDATE_INTERVAL ? parseInt(process.env.UPDATE_INTERVAL) : 300000
}