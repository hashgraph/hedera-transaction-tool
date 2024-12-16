[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Getting Started

The Transaction Tool backend is responsible for facilitating the process by which a transaction is required to be
signed by multiple users. This includes creating, sharing, collecting signatures, preparing for submission, and executing
the transactions to the specified network.

**Personal User Mode**: You do not need to set up your local backend to use the application in personal mode.
Personal mode allows you to create, sign and submit transactions that requires one user to sign.

**Organizational User Mode**:
The Transaction Tool application can be used without setting up the
back end in personal mode. The backend is not required if you are not developing features in the Organization flow.
To set-yup the front end application, you will need to follow this addition readme.

# Prerequisites

- [Node](https://nodejs.org/en/download/package-manager) version: >=`22.12.0`
- Version check: `node-v`
- [pnpm](https://pnpm.io/installation) version: >=`9.13.1`
- Version check: `pnpm --version`
- [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/)

# 1. Clone the project

```bash
git clone https://github.com/hashgraph/hedera-transaction-tool.git
cd back-end
```

# 2. Install Dependencies

```bash
pnpm install
```

## 3. Fill `.env` files

There are `example.env` files in the following directories:

- `apps/api`
- `apps/chain`
- `apps/notifications`
- `scripts`
- the root one

1. Create a `.env` from the `example.env` files. The default values works for development

## 4. Create Brevo Account

Brevo account enables you to set-up the notification system in the application. You will need to create a free tier Brevo account

1. Create a free tier [Brevo account](https://onboarding.brevo.com/account/register)
2. Login to your account
3. Click on the drop down menu on the top right of the page next to the notifications icon
4. Click on SMTP & API
5. Copy the SMTP key value
6. Enter the SMTP key in the apps/api/notifications `.env`

```
   BREVO_USERNAME=<your brevo username>
   BREVO_PASSWORD=<your brevo password>
```

## 5. Deploy

You can deploy the backend for local development in two ways

- Docker
- Kubernetes

### Deploy Using Docker

**HTTP Mode**
In the root of the `backend` directory run the following Docker command:

```bash
docker-compose up
```

This mode is used for testing the client application in development mode.

**HTTPS Mode (Preferred)**

For HTTPS mode, you are required to create a self-signed certificate. Often used to test on BUILT electron client application. Please execute the following commands:

Make sure you have `mkcert` installed (on MACyou can install it with)

```bash
brew install mkcert
```

```bash
# if you don't have the cert directory
mkdir -p cert
mkcert -install
mkcert -key-file ./cert/key.pem -cert-file ./cert/cert.pem localhost
```

Run the following Docker command

```bash
docker-compose up
```

**Exposed Endpoints**
All ports are defined in the docker-compose.yaml file
The default ports are:

| Type                           | Endpoint                                        |
| ------------------------------ | ----------------------------------------------- |
| API Service Endpoint           | [http://localhost:3001](http://localhost:3001/) |
| Notifications Service Endpoint | [http://localhost:3020](http://localhost:3020/) |
| PgAdmin                        | [http://localhost:5050](http://localhost:5050/) |

### Deploy Using Kubernetes

#### [For local deployment on Kubernetes refer here](./k8s/dev/README.md)

When deploying to a server, it may be desired to use Kubernetes. The docker images are currently private. They must be created and pushed to an accessible location. Update the deployment files as needed.

A helm chart is forthcoming. Until then, use the following commands once connected to a cluster:

1.  Create the namespace:

    ```
    kubectl create -f ./namespace.yaml
    ```

2.  Setup postgres:

    ```
      kubectl apply -f ./postgres-secret.yaml
      kubectl apply -f ./postgres-deployment.yaml
    ```

3.  Install the helm chart and apply the rabbitmq definition:

    ```
    kubectl apply -f ./rabbitmq-secret.yaml

    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm install back-end bitnami/rabbitmq-cluster-operator \
      -f ./rabbitmq-values.yaml \
      --namespace hedera-transaction-tool

    kubectl apply -f ./rabbitmq-definition.yaml
    ```

4.  Install the helm chart for redis:
    ```
    helm install redis bitnami/redis --namespace hedera-transaction-tool --set auth.enabled=false --set architecture=standalone
    ```
5.  Apply the required secrets:
    ```
    kubectl apply -f ./jwt-secret.yaml
    kubectl apply -f ./otp-secret.yaml
    kubectl apply -f ./brevo-secret.yaml
    ```
6.  Deploy the services. Until migration is properly in place, the first time the api service is deployed, ensure that POSTGRES_SYNCHRONIZE is set to true in the yaml:
    ```
    kubectl apply -f ./api-deployment.yaml
    kubectl apply -f ./chain-deployment.yaml
    kubectl apply -f ./notifications-deployment.yaml
    ```
7.  The IP for the ingress can be set by the controller, or it can be set as a static IP. Either remove the loadBalancerIp value, or set it with a reserved IP.

8.  Install the ingress controller, and ingress.
    ```
    helm repo add traefik https://helm.traefik.io/traefik
    helm repo update
    helm install traefik traefik/traefik -f traefik-values.yaml
    ```
    Apply the ingress:
    ```
    kubectl apply -f ./ingress.yaml
    ```
9.  Using the actual name of the Postgres pod, connect to Postgres to create the admin user:
    ```
    kubectl exec -it <podname> -- psql -h localhost -U postgres --password -p 5432
    ```

## Adding a Local Organization to Your Local Development Environment

To add the local organization to your application, you will need to create an admin user. When you create your admin user,
you will need to enter an email address and password.

### Create your admin

Make sure you need your local database up and running. The script will create a new admin user for your in your local database.

1. Go to the `backend/scripts` folder
2. Run the following command:

```
pnpm create-admin
```

3. Enter an email address. You can use any email address.
4. Enter a password. You can enter any password.

### Add an Organization

1. Go to the Transaction Tool application
2. Add an organization
3. Enter a name for your local organization
4. Enter the local server URL: `https:/localhost:3001` or `http:/localhost:3001`

### Resetting Local Postgres Data

To reset the local postgres database, do the following:

```
docker-compose down
rm -rf <back-end base directory>/pgdata
docker-compose up
```

## Tests

- Unit/Integration Tests
- E2E Tests

### Unit/Integration

Tests are run per service. Navigate to the service you want to test. There you can use the test commands to run the tests and see the coverage
**API**

    cd apps/api
    pnpm test:cov

**Notifications**

    cd apps/notifications
    pnpm test:cov

**Chain**

    cd apps/chain
    pnpm test:cov

### E2E

Make sure you have Docker running.
The first task is to start Docker!

To run the E2E tests navigate to the the desired service and follow the steps below:  
A testing containers for `Postgres`, `Redis`, `RabbitMQ` and `Hedera Localnet` will be started once you run the test command.

Things to notice:

- Note that you should not have the back-end running, stop it!

- Note that after running the tests you may receive an error when starting the back-end with `docker compose`. This problem is mitigated by recreating the back-end containers, to do so start the back-end with the `--force-recreate` flag:

  ```bash
  docker compose up --force-recreate
  ```

- Note that the `Hedera Localnet` may boot up slowly, if you want to speed-up the process, start it manually by running:

  ```bash
  pnpx hedera restart -d
  ```

After the reading the above notes, start the tests:

```bash
cd apps/api
pnpm test:e2e
```

# Troubleshooting

If you are having issues getting your local development environment set up consider the following:

- Delete the `node_modules` folder in the `frontend` or `backend` or both directories. Reinstall `node_modules` with `pnpm install`
- Delete the `pgdata` folder found in the `backend` directory. Run `docker compose --build`
- Verify you are connected to your local development backend to observe the deployed changes and not your staging backend
