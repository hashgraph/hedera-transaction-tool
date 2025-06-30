Please refer to the [StackGres documentation](https://stackgres.io/doc/1.16/reference/crd/) for more information. Specifically please refer to the [Sharded Cluster](https://stackgres.io/doc/1.16/reference/crd/#sgshardedcluster) section.

Stackgres creates a random password for the `postgres` user. So use the SGScript CRD to create a script that will create a known database user and password.
