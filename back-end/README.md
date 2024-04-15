[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Hedera Transaction Tool Backend

The Hedera Transaction Tool application is a demo application that allows a user to generate keys, create, sign, and submit transactions to a Hedera network. This software is designed for use solely by the Hedera Council and staff. The software is being released as open source as example code only, and is not intended or suitable for use in its current form by anyone other than members of the Hedera Council and Hedera personnel. If you are not a Hedera Council member or staff member, use of this application or of the code in its current form is not recommended
and is at your own risk.

## Prerequisites

- Node version: `20.9.0`
- pnpm version: `8.15.6`
- [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/)

If you use another version, please use [n](https://github.com/tj/n) to manage.

### Install dependencies ⏬

```bash
pnpm install -r
```

Before running the project please create `.env` in `back-end`, `apps/api`, `apps/chain`,
and `apps/notifications`. See the example.env in each location for the required variables.
Or copy the existing example.env in each location.

```shell
cp example.env .env
```

### Start developing ⚒️

As some services are dependent on other services, they must be run together.
This can be done in docker. Install and run Docker Desktop.
From the back-end directory, run:

```bash
docker-compose up
```

### Deploy on Kubernetes

When deploying to a server, it may be desired to use Kubernetes. More info needed.

### Resetting Local Postgres Data

To reset the local postgres database, do the following:

```bash
docker-compose down
rm -rf <back-end base directory>/pgdata
docker-compose up
```

### Create Admin

1. Make sure at least the database is running or just `docker compose up`
2. Create `.env` file inside `scripts` folder
3. Run `npm run create-admin` and follow the steps
