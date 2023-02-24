![docs/logo.png](docs/logo.png)

TT Stats Updater
===

> A Node process to keep player stats from the TT squad server updated in redis for rapid retrieval

This project utilizes an nvmrc file. Use it.

Ensure you have copied the .env.example file into your project root and populated all environment variable values before running

#### Environment Setup:

```bash
DEBUG=

DB_HOST=
DB_PORT=
DB_USER=
DB_PASS=
DB_NAME=

REDIS_HOST=
REDIS_PORT=6379
REDIS_PASS=
REDIS_BATCH_SIZE=100#The number of requests sent per pipeline to Redis. Redis recommends batches of 100

UPDATE_INTERVAL=300000#5 minutes

# different versions of squadjs used  different table naming conventions, this prevents 
TABLE_DEATHS=
TABLE_REVIVES=
TABLE_DOWNS=
TABLE_PLAYERS=
TABLE_SERVERS=
TABLE_MATCHES=

# adds the ability to ignore stats from specific layers that include specific strings, comma separated
LAYERS_TO_IGNORE=jensens,seed
```

The `UPDATE_INTERVAL` determines how often the update script will execute. This value is in ms. The default value of `300000` corresponds to 5 minutes.