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
npm run test:cov
```

```bash
cd apps/notifications
npm run test:cov
```

```bash
cd apps/chain
npm run test:cov
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
3. Run `npm run create-admin` and follow the steps

### Start developing on HTTPS

1. First you need to create self-signed certificate

   ```bash
   mkdir -p cert # if you don't have the cert directory
   mkcert -install
   mkcert -key-file ./cert/key.pem -cert-file ./cert/cert.pem localhost
   ```

2. Next, set the `NODE_ENV` to `testing`, you can set it in the root `.env`

3. Now, open api's [main.ts](./apps/api/src/main.ts) and uncomment the code that initializes the Nest application with https options and comment the other one

4. Run
   ```bash
   docker-compose up
   ```

### Deploy on Kubernetes

When deploying to a server, it may be desired to use Kubernetes.
The docker images are currently private. They must be created and pushed
to an accessible location. Update the deployment files as needed.

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
   helm repo add bitnami https://charts.bitnami.com/bitnami
   helm install back-end bitnami/rabbitmq-cluster-operator --namespace hedera-transaction-tool

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
   kubectl apply -f ./api/deployment.yaml
   kubectl apply -f ./chain/deployment.yaml
   kubectl apply -f ./notifications/deployment.yaml
   ```
7. Setup SSL. The [cert-manager guide](https://cert-manager.io/docs/tutorials/getting-started-with-cert-manager-on-google-kubernetes-engine-using-lets-encrypt-for-ingress-ssl/) describes the process, but in short:

   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.5/cert-manager.yaml --namespace hedera-transaction-tool
   ```

   Install the issuer (this issuer uses Lets Encrypt's production service, use the staging service for testing):

   ```bash
   kubectl apply -f ./issuer-lets-encrypt-production.yaml
   ```

   Install the secret that holds the key and cert:

   ```bash
   kubectl apply -f ./ssl-secret.yaml
   ```

8. The ingress uses the name of a previously reserved static ip (named 'web-ip'). If using the GCP console, this can be done in VPC Network -> IP Addresses. Deploy the ingress:

   ```bash
   kubectl apply -f ./ingress.yaml
   ```

   Note: if there are issues with the issuer and ingress, the ingress may have to be applied without ssl options before step 7.

9. Using the actual name of the Postgres pod, connect to Postgres to create the admin user:

   ```bash
   kubectl exec -it <podname> -- psql -h localhost -U postgres --password -p 5432
   ```
