### Deploy on Kubernetes

1. **Make sure that a Kubernetes Cluster is running**

2. For automatic context switching before deployment, create a .env file in this folder, following the `.env.example` template

3. **(First time only)** Create `email-api-secret.yaml` from `email-api-secret.example.yaml` with your Brevo (or other provider) credentials

#### You can use either the `deploy.sh` script or manually deploy each resource

#### **Usage of the `deploy.sh` (Preferred)**

1. Run the script `sh deploy.sh` or `./deploy.sh`

#### **Manual deployment**

1. **(First time only)** Create a secret for your self-signed certificate \
   (Follow the steps in the root README to generate one if you don't have)

   ```bash
   kubectl create secret tls self-signed-certificate --cert=../../cert/cert.pem --key=../../cert/key.pem
   ```

2. **(On back-end change only)** Build Docker images from the root `back-end` folder

   ```bash
   docker build -t back-end-api:1.0.0 -f ./apps/api/Dockerfile .
   ```

   ```bash
   docker build -t back-end-chain:1.0.0 -f ./apps/chain/Dockerfile .
   ```

   ```bash
   docker build -t back-end-notifications:1.0.0 -f ./apps/notifications/Dockerfile .
   ```

3. Apply the deployments inside `k8s/dev/deployments`

   ```bash
   kubectl apply -f ./deployments
   ```

4. Install Ingress Controller

   ```bash
   helm repo add traefik https://helm.traefik.io/traefik
   helm repo update
   helm install traefik traefik/traefik
   ```

5. Apply Ingress from `k8s/dev`

   ```bash
   kubectl apply -f ./ingress.yaml
   ```

6. Expose the `postgres`

   ```bash
   kubectl port-forward svc/postgres-ext-service 5432:5432
   ```

7. Stop

   ```bash
   kubectl delete --all deployments,ingresses
   helm uninstall traefik
   ```

### Troubleshooting

- When installing `traefik`, if you receive `Error: INSTALLATION FAILED: cannot re-use a name that is still in use`, run:

  ```bash
  helm upgrade traefik traefik/traefik
  ```
