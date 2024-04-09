[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Hedera Transaction Tool Backend

The Hedera Transaction Tool application is a demo application that allows a user to generate keys, create, sign, and submit transactions to a Hedera network. This software is designed for use solely by the Hedera Council and staff. The software is being released as open source as example code only, and is not intended or suitable for use in its current form by anyone other than members of the Hedera Council and Hedera personnel. If you are not a Hedera Council member or staff member, use of this application or of the code in its current form is not recommended
and is at your own risk.

## Prerequisites

- Node version: `20.9.0`
- pnpm version: `8.15.6`
- Docker Desktop

If you use another version, please use [n](https://github.com/tj/n) to manage.

### Install dependencies ⏬

```bash
pnpm install -r
```

Before running the project please create `.env` in `apps/api` or use the example one.

```shell
cp example.env .env
```

```
HTTP_PORT = 3000
TCP_PORT = 3001
JWT_SECRET =
JWT_EXPIRATION = 36000
```

### Start developing ⚒️

As some services are dependent on other services, they must be run together.
This can be done in docker. Install [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/)
and start it up. From the back-end directory, run:

```bash
docker-compose up
```
