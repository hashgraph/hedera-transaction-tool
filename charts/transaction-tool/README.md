If you want to create a simple postgres single pod cluster for dev purposes simply set `stackgres.enabled` to `false`

When trying to run a production cluster you should use the `SGShardedCluster` CRD of stackgres. This is simply done by setting `stackgres.enabled` to `true` and providing the required parameters in the `values.yaml` file.

Please refer to the [StackGres documentation](https://stackgres.io/doc/1.16/reference/crd/) for more information. Specifically please refer to the [Sharded Cluster](https://stackgres.io/doc/1.16/reference/crd/#sgshardedcluster) section.

Stackgres creates a random password for the `postgres` user. So use the SGScript to create a script that with create a know database user and password.
