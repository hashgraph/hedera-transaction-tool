## Release the app

1. Create Draft release with the proper tag (version in `package.json` needs to match) and prefix `v`
2. Genereate Classic access token (check the `repo` option)
3. Generate self sign certificate (TBD)
4. Run in terminal `GH_TOKEN=<ACCESS_TOKEN> npm run publish`
5. Go to Releases and click `Publish release`
