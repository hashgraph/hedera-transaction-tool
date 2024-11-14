[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Hedera Transaction Tool Backend

The Hedera Transaction Tool application is a demo application that allows a user to generate keys, create, sign, and submit transactions to a Hedera network. This software is designed for use solely by the Hedera Council and staff. The software is being released as open source as example code only, and is not intended or suitable for use in its current form by anyone other than members of the Hedera Council and Hedera personnel. If you are not a Hedera Council member or staff member, use of this application or of the code in its current form is not recommended
and is at your own risk.

The `back-end` directory contains the following microservices:

### API

The first module should serve as the main API responsible for handling user requests, managing user authentication and authorization, and handling database operations. This module will handle tasks such as user management, authentication, transaction creation, transaction operations, notifications, and all other user-required methods.

### Chain

Functions as a chain processor that is responsible for monitoring the Hedera mainnet, executing transactions, and updating the transaction statuses in real time. This module will listen for events on the Hedera mainnet, execute transactions according to the user's actions, and update the transaction statuses based on the response from the Hedera network.

## Prerequisites

- [Node](https://nodejs.org/en/download/package-manager) version: >=`20.9.0`
- [pnpm](https://pnpm.io/installation) version: >=`8.15.6`
- [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/)
- [Brevo](https://www.brevo.com/pricing/?utm_source=adwords_brand&utm_medium=lastclick&utm_content=SendinBlue&utm_extension=sitelinks&utm_term=brevo&utm_matchtype=e&utm_campaign=20011980161&utm_network=g&km_adid=683810310625&km_adposition=&km_device=c&utm_adgroupid=151171466311&gad_source=1&gclid=CjwKCAjwupGyBhBBEiwA0UcqaJ5UFQ8uNznjz1kUfokSV1JhaWfwqFgXrNfRrB2jqE0g4LCLaKNxpBoCsw8QAvD_BwE) username and password

If you use another version, please use [n](https://github.com/tj/n) to manage.

### Install dependencies ⏬

```bash
pnpm install
```

Before running the project please create `.env` in `back-end`, `apps/api`, `apps/chain`,
and `apps/notifications`. See the example.env in each location for the required variables.
Or copy the existing example.env in each location.

```shell
cp example.env .env
```

### Choose the mode in which the application will work

### Start developing ⚒️

(Often used to test on electron client application in development mode)

As some services are dependent on other services, they must be run together.
This can be done in docker. Install and run Docker Desktop.

1. Make sure you don't have `cert` folder, containing self-signed certificate for HTTPS mode
2. Make sure you have not set `NODE_ENV=production` in your `.env` files or it should be `development`
3. From the root directory, run:

```bash
docker-compose up
```

`Important! If error is received, add --force-recreate`

### Start developing on HTTPS ⚒️ or Prepare for Automation tests

(Often used to test on BUILT electron client application)

1. First you need to create self-signed certificate

   ```bash
   mkdir -p cert # if you don't have the cert directory
   mkcert -install
   mkcert -key-file ./cert/key.pem -cert-file ./cert/cert.pem localhost
   ```

2. Next, set the `NODE_ENV` to `testing`, do this in every `.env`

3. Run
   ```bash
   docker-compose up
   ```

### Resetting Local Postgres Data

To reset the local postgres database, do the following:

```bash
docker-compose down
rm -rf <back-end base directory>/pgdata
docker-compose up
```

### Running tests

Tests are run per service. Navigate to the service you want to test. There you can use the test commands to run the tests and see the coverage

```bash
cd apps/api
pnpm run test:cov
```

```bash
cd apps/notifications
pnpm run test:cov
```

```bash
cd apps/chain
pnpm run test:cov
```

### Running E2E test

The first task is to start Docker!

To run the E2E tests navigate to the the desired service and follow the steps below: \
A testing containers for `Postgres`, `Redis`, `RabbitMQ` and `Hedera Localnet` will be started once you run the test command.

Things to notice:

- Note that you should not have the back-end running, stop it!

- Note that after running the tests you may receive an error when starting the back-end with `docker compose`. This problem is mitigated by recreating the back-end containers, to do so start the back-end with the `--force-recreate` flag:

```bash
docker compose up --force-recreate
```

- Note that the `Hedera Localnet` may boot up slowly, if you want to speed-up the process, start it manually by running:

```bash
pnpx hedera start -d
```

After the reading the above notes, start the tests:

```bash
cd apps/api
pnpm run test:e2e
```

### Exposed Endpoints

All ports are defined in the [`docker-compose.yaml`](./docker-compose.yaml)

The defaults are:

| Type                           | Endpoint                                       |
| ------------------------------ | ---------------------------------------------- |
| API Service Endpoint           | [http://localhost:3001](http://localhost:3001) |
| Notifications Service Endpoint | [http://localhost:3020](http://localhost:3020) |
| PgAdmin                        | [http://localhost:5050](http://localhost:5050) |

### Create Admin

1. Make sure at least the database is running or just `docker compose up`
2. Create `.env` file inside `scripts` folder
3. Run `pnpm run create-admin` and follow the steps

### Deploy on Kubernetes

#### <b>A simple Kubernetes development deployment in [here](./k8s/dev/README.md)</b>

When deploying to a server, it may be desired to use Kubernetes.
The docker images are currently private. They must be created and pushed
to an accessible location. Examples of the secret files are supplied,
the secrets need to be encoded to be set. Update the deployment files as needed.

A helm chart is forthcoming.
Until then, use the following commands once connected to a cluster:

1. Create the namespace:

   ```bash
   kubectl create -f ./namespace.yaml
   ```

2. Setup postgres:

   ```bash
   kubectl apply -f ./postgres-secret.yaml
   kubectl apply -f ./postgres-deployment.yaml
   ```

3. Install the helm chart and apply the rabbitmq definition:

   ```bash
   kubectl apply -f ./rabbitmq-secret.yaml

   helm repo add bitnami https://charts.bitnami.com/bitnami
   helm install back-end bitnami/rabbitmq-cluster-operator \
     -f ./rabbitmq-values.yaml \
     --namespace hedera-transaction-tool

   kubectl apply -f ./rabbitmq-definition.yaml
   ```

4. Install the helm chart for redis:

   ```bash
   helm install redis bitnami/redis --namespace hedera-transaction-tool --set auth.enabled=false --set architecture=standalone
   ```

5. Apply the required secrets:

   ```bash
   kubectl apply -f ./jwt-secret.yaml
   kubectl apply -f ./otp-secret.yaml
   kubectl apply -f ./brevo-secret.yaml
   ```

6. Deploy the services. Until migration is properly in place, the first time the api service is deployed, ensure that POSTGRES_SYNCHRONIZE is set to true in the yaml:

   ```bash
   kubectl apply -f ./api-deployment.yaml
   kubectl apply -f ./chain-deployment.yaml
   kubectl apply -f ./notifications-deployment.yaml
   ```

7. The IP for the ingress can be set by the controller, or it can be set as a static IP. Either remove the loadBalancerIp value, or set it with a reserved IP.

8. Install the ingress controller, and ingress.

   ```bash
   helm repo add traefik https://helm.traefik.io/traefik
   helm repo update
   helm install traefik traefik/traefik -f traefik-values.yaml
   ```

   Apply the ingress:

   ```bash
   kubectl apply -f ./ingress.yaml
   ```

9. Using the actual name of the Postgres pod, connect to Postgres to create the admin user:

   ```bash
   kubectl exec -it <podname> -- psql -h localhost -U postgres --password -p 5432
   ```
