![docs/logo.png](docs/logo.png)

TT Stats Updater
===

> A node process that connects to the squadjs database and periodically syncs player's stats and stores them in redis for realtime retrieval. This process is a companion to the tt-squad-bot project which can be found here [TT Squad Bot](https://github.com/z1haze/tt-squad-bot)

#### The current version of this process tracks the following data:

##### For each player:

- Incaps (times they've downed another player)
- Kills (times a player they've killed has bled out or given up)
- Falls (times the player has been incapacitated themselves [I know the name sucks, couldn't think of a better one])
- Deaths (times the player has been dead dead)
- K/D (kills divided by deaths)
- I/D (incaps divided by deaths)
- Revives (times the player has revived another player)
- Revived (times the player has been revived by another player)
- Teamkills (times the player has killed a teammate AND that teammate has given up or bled out)
- Teamkilled (times the player has bled or our given up after being downed by a teammate)
- Matches Played (number of matches that a player has recorded at least one of the aforementioned stats)
- Rating (Our numerical rating system that attempts to calculate an overall player rating based on the stats we have available to us)

##### In addition to individual player stats, we also store the following data for leaderboards:

- Games Played
- Rating
- Deaths
- Incaps
- Killing Efficiency (how likely a player it to convert an incap into a kill)
- Falls
- Death Efficiency (how likely a player is to die after being downed [lower is better])
- Revives
- Revived
- K/D
- I/D
- Teamkills
- Teamkilled

> This project utilizes a nvmrc file. Use it.

Ensure you have copied the .env.example file into your project root and populated all environment variable values before running

### How do I use this thing?

First and foremost you must have the following installed:

1. Node.js 17 or later (refer to the nvmrc file for the exact version)
2. MySQL/MariaDB
3. Squad JS running the DBLOG plugin
4. Redis Server

Once the above requirements are met:

1. cd into the project root and `nvm use && npm install`
2. For production, you will want to build the project by running `npm run build`
3. Start the process for production by running `start:prod` (after building it in the previous step)

Once you have all of the above installed and configured, copy the .env.example file to .env and populate all the environment variables with the appropriate values. Then the process is able to be started by running `npm run start`

#### Environment Setup:

```bash
# enable debugging to monitor various lengths of time certain processes take
DEBUG=

DB_HOST=
DB_PORT=
DB_USER=
DB_PASS=
DB_NAME=

REDIS_HOST=
REDIS_PORT=
REDIS_PASS=6379

# redis recommends leaving this to 100
REDIS_BATCH_SIZE=100

# determines how often the update script will execute. This value is in ms.
# The default value of 300000 corresponds to 5 minutes.
UPDATE_INTERVAL=300000

# database tables
TABLE_DEATHS=
TABLE_REVIVES=
TABLE_DOWNS=
TABLE_PLAYERS=
TABLE_SERVERS=
TABLE_MATCHES=

# date from which to show stats from
SEASON_START="1970-01-01T00:00:00Z"

# how many matches a player requires before showing up in the leaderboards
MATCHES_MINIMUM=10

# you can ignore certain layers by adding them to this comma separated list
# it uses a fuzzy search so you can just add a part of the layer name
LAYERS_TO_IGNORE=jensen,seed
```
