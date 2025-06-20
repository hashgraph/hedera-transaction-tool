If you want to create a simple postgres single pod cluster for dev purposes simply set `stackgres.enabled` to `false`

When trying to run a production cluster you should use the `SGShardedCluster` CRD of stackgres.

Please refer to the [StackGres documentation](https://stackgres.io/doc/1.16/reference/crd/) for more information. Specifically please refer to the [Sharded Cluster](https://stackgres.io/doc/1.16/reference/crd/#sgshardedcluster) section.
