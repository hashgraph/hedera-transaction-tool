[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Hedera Transaction Tool

The Hedera Transaction Tool application is a demo application that allows a user to generate keys, create, sign, and submit transactions to a Hedera network. This software is designed for use solely by the Hedera Council and staff. The software is being released as open source as example code only, and is not intended or suitable for use in its current form by anyone other than members of the Hedera Council and Hedera personnel. If you are not a Hedera Council member or staff member, use of this application or of the code in its current form is not recommended
and is at your own risk.

## Prerequisites

Node version: `20.9.0`

If you use another version, please use [n](https://github.com/tj/n) to manage.

### Install dependencies ⏬

```bash
npm install
```

Before running the project please create `.env` or use the example one.

```shell
cp .env.example .env
```

```
NODE_ENV=development
```

### Run the following command to start Vue devtools

```bash
npm run devTools
```

### Start developing ⚒️

```bash
npm run dev
```

### Additional Commands

```bash
npm run dev # starts application with hot reload
npm run build # builds application, distributable files can be found in "dist" folder

# OR

npm run build:mac # uses mac as build target
```

## Publish

1. Create Draft release with the proper tag (version in `package.json` needs to match) and prefix `v`
2. Genereate Classic access token (check the `repo` option)
3. Generate self sign certificate (TBD)
4. Make sure `NODE_ENV` is set to `production` in the .env file
5. Run in terminal `GH_TOKEN=<ACCESS_TOKEN> npm run publish`
6. Go to Releases and click `Publish release`


## Contributing

Contributions are welcome. Please see the
[contributing guide](https://github.com/hashgraph/.github/blob/main/CONTRIBUTING.md)
to see how you can get involved.

## Code of Conduct

This project is governed by the
[Contributor Covenant Code of Conduct](https://github.com/hashgraph/.github/blob/main/CODE_OF_CONDUCT.md). By
participating, you are expected to uphold this code of conduct. Please report unacceptable behavior
to [oss@hedera.com](mailto:oss@hedera.com).

## License

[Apache License 2.0](LICENSE)
