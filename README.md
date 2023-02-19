![docs/logo.png](docs/logo.png)

TT Stats Updater
===

> A Node process to keep player stats from the TT squad server updated in redis for rapid retrieval

This project utilizes an nvmrc file. Use it.

Ensure you have copied the .env.example file into your project root and populated all environment variable values before running

#### Environment Setup:

```bash
NODE_ENV=development

DB_HOST=
DB_PORT=
DB_USER=
DB_PASS=
DB_NAME=

REDIS_HOST=
REDIS_PORT=
REDIS_BATCH_SIZE=100

UPDATE_INTERVAL=300000
```

The `UPDATE_INTERVAL` determines how often the update script will execute. This value is in ms. The default value of `300000` corresponds to 5 minutes.