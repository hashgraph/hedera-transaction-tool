### Deploy on Kubernetes

1. <b>Make sure that a Kubernetes Cluster is running</b>

2. <b>(First time only)</b> Create `brevo-secret.yaml` from `brevo-secret.example.yaml` with your Brevo credentials

#### You can use either the `deploy.sh` script or manually deploy each resource

#### Usage of the `deploy.sh` (Preferred)

3.  Run the script `sh deploy.sh` or `./deploy.sh`

#### Manual deployment

3. <b>(First time only)</b> Create a secret for your self-signed certificate \
   (Follow the steps in the root README to generate one if you don't have)

   ```bash
   kubectl create secret tls self-signed-certificate --cert=../../cert/cert.pem --key=../../cert/key.pem
   ```

4. <b>(On back-end change only)</b> Build Docker images from the root `back-end` folder

   ```bash
   docker build -t back-end-api:1.0.0 -f ./apps/api/Dockerfile .
   ```

   ```bash
   docker build -t back-end-chain:1.0.0 -f ./apps/chain/Dockerfile .
   ```

   ```bash
   docker build -t back-end-notifications:1.0.0 -f ./apps/notifications/Dockerfile .
   ```

5. Apply the deployments inside `k8s/dev/deployments`

   ```bash
   kubectl apply -f ./deployments
   ```

6. Install Ingress Controller

   ```bash
   helm repo add traefik https://helm.traefik.io/traefik
   helm repo update
   helm install traefik traefik/traefik
   ```

7. Apply Ingress from `k8s/dev`

   ```bash
   kubectl apply -f ./ingress.yaml
   ```

8. Expose the `postgres`

   ```bash
   kubectl port-forward svc/postgres-ext-service 5432:5432
   ```

9. Stop

   ```bash
   kubectl delete --all deployments,ingresses
   helm uninstall traefik
   ```

### Troubleshooting

- When installing `traefik`, if you receive `Error: INSTALLATION FAILED: cannot re-use a name that is still in use`, run:

  ```bash
  helm upgrade traefik traefik/traefik
  ```
