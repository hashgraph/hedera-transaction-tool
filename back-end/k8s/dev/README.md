### Deploy on Kubernetes

Make sure that Kubernetes is enabled

1. Build Docker images from the root `back-end` folder

   ```bash
   docker build -t back-end-api:1.0.0 -f ./apps/api/Dockerfile .
   ```

   ```bash
   docker build -t back-end-chain:1.0.0 -f ./apps/chain/Dockerfile .
   ```

   ```bash
   docker build -t back-end-notifications:1.0.0 -f ./apps/notifications/Dockerfile .
   ```

2. Create deployments from `k8s/dev`

   ```bash
   kubectl apply -f ./
   ```

3. Install Ingress Controller (currently NGINX, will change)

   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0-beta.0/deploy/static/provider/cloud/deploy.yaml
   ```

4. Apply Ingress from `k8s/dev`

   ```bash
   kubectl apply -f ./
   ```

5. Expose the `postgres`

   ```bash
   kubectl port-forward svc/postgres-ext-service 5432:5432
   ```

6. Stop

   ```bash
   kubectl delete --all deployments,ingresses,ingressclasses
   ```
