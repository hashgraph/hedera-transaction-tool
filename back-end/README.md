[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Getting Started

The Transaction Tool backend is responsible for facilitating the process by which a transaction is required to be
signed by multiple users. This includes creating, sharing, collecting signatures, preparing for submission, and executing
the transactions to the specified network.

# Usage Modes

**Personal User Mode**: You do not need to set up your local backend to use the application in personal mode.
Personal mode allows you to create, sign and submit transactions that requires one user to sign.

**Organizational User Mode**:
The Transaction Tool application can be used without setting up the
backend in personal mode. The backend is not required if you are not developing features in the Organization flow.
To setup the frontend application, Follow the complete setup process below..

# Prerequisites

- [**Node.js**](https://nodejs.org/en/download/package-manager)

  - Required version: `>= 22.12.0`
  - Verify installation:

    ```bash
    node -v
    ```

- [**pnpm**](https://pnpm.io/installation)

  - Required version: `>= 9.13.1`
  - Installation of `pnpm`(if not already installed):

    ```bash
    npm install -g pnpm@latest
    ```

  - Verify installation:
    ```bash
    pnpm --version
    ```

- [**Python setuptools**](https://pypi.org/project/setuptools)

  - Required version: `>= 75.6.0`
  - Installation of `python-setuptools` with `brew`:

    ```bash
    brew install python-setuptools
    ```

  - Verify installation:
    ```bash
    python -m setuptools --version
    ```

- **Docker Desktop with Kubernetes enabled**
  - Enable Kubernetes: Docker Desktop → Settings → Kubernetes → Enable Kubernetes → Apply & Restart.

## 1. Clone the project

```bash
git clone https://github.com/hashgraph/hedera-transaction-tool.git
cd hedera-transaction-tool/back-end
```

## 2. Install dependencies

```bash
pnpm install
```

## 3. Environment Configuration

Create `.env` files from the provided `example.env` templates in each of the following directories:

- `apps/api`
- `apps/chain`
- `apps/notifications`
- `typeorm`
- `scripts`
- the root one

The default values work for development.

## 4. Email API Configuration

An email api account enables you to set-up the notification system in the application. You will need to create a free tier Brevo account, or another provider of your choosing.

> **Note:** some providers require no username and password, such as Gmail's smtp-relay service. These values, therefore, are optional.

Example: Create Brevo Account:

1. Create a free tier [Brevo account](https://onboarding.brevo.com/account/register)
2. Log in to your account.
3. Select the drop down menu in the top-right corner (next to the notifications icon).
4. Select Settings from the dropdown menu.
5. In the left sidebar under Organization settings, select SMTP & API.
6. Locate your SMTP key in the SMTP keys table.
7. (Optional) If no SMTP key appears, select **Generate a new SMTP Key** in the top-right corner.
8. Copy the SMTP key value and add it to your `apps/notifications/.env`:

```
   EMAIL_API_HOST=smtp-relay.brevo.com
   EMAIL_API_PORT=587
   EMAIL_API_SECURE=false
   EMAIL_API_USERNAME=<your Brevo login email>
   EMAIL_API_PASSWORD=<your SMTP key from step 6>
   SENDER_EMAIL=no-reply@<yourdomain.com>
```

## 5. Create Email API Secret for Kubernetes

(First time only) Create `email-api-secret.yaml` from the example template:

1.  Navigate to `backend/k8s/dev/`
2.  Copy `email-api-secret.example.yaml` to `email-api-secret.yaml`
3.  Update the file with your Brevo (or other provider) credentials from step 4.

## 6. Deployment on Kubernetes

Ensure Kubernetes cluster is running (Docker Desktop with Kubernetes enabled).

**HTTPS Mode Setup (Preferred)**

(First time only) Create self-signed certificates for HTTPS. Required for testing with the built Electron client application.

1. **Install mkcert (macOS example)**:

   ```bash
   brew install mkcert
   ```

2. **Create cert directory (if it doesn't exist):**

   ```bash
   mkdir -p cert
   ```

3. **Generate certificates:**
   ```bash
   mkcert -install
   mkcert -key-file ./cert/key.pem -cert-file ./cert/cert.pem localhost
   ```

### Deployment Options

You can deploy using either the automated script (preferred) or manual steps.

Option 1: Automated Deployment (Preferred)

```bash
pnpm deploy:dev
# or
./deploy.sh
```

Option 2: Manual Deployment

1. (First time only) Create Kubernetes secret for self-signed certificate:

   ```bash
   kubectl create secret tls self-signed-certificate --cert=./cert/cert.pem --key=./cert/key.pem
   ```

2. (On backend changes only) Build Docker images from the root back-end folder:

   ```bash
   # API service
   docker build -t back-end-api:1.0.0 -f ./apps/api/Dockerfile .

   # Chain service
   docker build -t back-end-chain:1.0.0 -f ./apps/chain/Dockerfile .

   # Notifications service
   docker build -t back-end-notifications:1.0.0 -f ./apps/notifications/Dockerfile .
   ```

3. Apply deployments:

   ```bash
   kubectl apply -f ./k8s/dev/deployments
   ```

4. Install Ingress Controller:

   ```bash
   helm repo add traefik https://helm.traefik.io/traefik
   helm repo update
   helm install traefik traefik/traefik
   ```

5. Apply Ingress configuration:

   ```bash
   kubectl apply -f ./k8s/dev/ingress.yaml
   ```

6. Expose PostgreSQL service:

   ```bash
   kubectl port-forward svc/postgres 5432:5432
   ```

**Exposed Endpoints**:

All ports are defined in the `docker-compose.yaml` file.
The default ports are:

| Type                           | Endpoint                                                           |
| ------------------------------ | ------------------------------------------------------------------ |
| API Service Endpoint           | [https://localhost](https://localhost)                             |
| Notifications Service Endpoint | [https://localhost/notifications](https://localhost/notifications) |
| PgAdmin                        | [https://localhost:5050](https://localhost:5050)                   |

## Stopping the Deployment

To stop all services:

```bash
kubectl delete --all deployments,ingresses
helm uninstall traefik
```

## Adding a Local Organization to Your Local Development Environment

To add the local organization to your application for development:

### Create your admin

Ensure your local database is running, then create an admin user:

```bash
cd backend/scripts
pnpm create-admin
```

Follow the prompts to:

- Enter an email address (can be any email).
- Enter a password (can be any password).

### Add an Organization

1. Go to the Transaction Tool application.
2. Select **Add an organization**.
3. Enter a name for your local organization.
4. Enter the local server URL: `https://localhost`

## Testing

Tests are run separately for each service. Navigate to the service you want to test and run the test commands:

**API**

    cd apps/api
    pnpm test:cov

**Notifications**

    cd apps/notifications
    pnpm test:cov

**Chain**

    cd apps/chain
    pnpm test:cov

# Troubleshooting

1. If you encounter setup problems:

   - Delete the `node_modules` folder in the `frontend` or `backend` or both directories. Reinstall `node_modules` with `pnpm install`.
   - Delete the `pgdata` folder found in the `backend` directory. Run `docker compose --build`.
   - Verify you are connected to your local development backend to observe the deployed changes and not your staging backend.

2. When installing `traefik`, if you receive `Error: INSTALLATION FAILED: cannot re-use a name that is still in use`:

   ```bash
   helm upgrade traefik traefik/traefik
   ```

3. Docker Image Pull Errors

If you encounter Cloudflare storage connection errors:

```
error pulling image configuration: download failed after attempts=6:
dialing docker-images-prod.6aa30f8b08e16409b46e0173d6de2f56.r2.cloudflarestorage.com:443
```

**Solution**: Use DockerHub Mirror

1. Pull from mirror registry:

   ```bash
   docker pull mirror.gcr.io/library/node:22-alpine
   ```

2. Tag the image:

   ```bash
   docker tag mirror.gcr.io/library/node:22-alpine node:22-alpine
   ```

**Alternative**: Configure Docker Desktop Registry Mirrors:

1. Open Docker Desktop → Settings → Docker Engine.
2. Add registry mirror configuration:
   ```
   {
     "registry-mirrors": [
       "https://your-mirror-url/"
     ]
   }
   ```
3. Click Apply & Restart.
