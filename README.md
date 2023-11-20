# Hedera Transaction Tool

Node version: `20.9.0`

If you use another version, please use [n](https://github.com/tj/n) to manage.

# Install dependencies ⏬

```bash
npm install
```

### Run the following command to start Vue devtools

```bash
npm run devTools
```

### Start developing ⚒️

```bash
npm run dev
```

## Additional Commands

```bash
npm run dev # starts application with hot reload
npm run build # builds application, distributable files can be found in "dist" folder

# OR

npm run build:mac # uses mac as build target
```

# Publish

1. Create Draft release with the proper tag (version in `package.json` needs to match) and prefix `v`
2. Genereate Classic access token (check the `repo` option)
3. Generate self sign certificate (TBD)
4. Run in terminal `GH_TOKEN=<ACCESS_TOKEN> npm run publish`
5. Go to Releases and click `Publish release`
