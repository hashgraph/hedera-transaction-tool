If you want to create a simple postgres cluster for dev purposes simply use the `SGCluster` CRD of stackgres

When trying to run a production cluster you should use the `SGShardedCluster` CRD of stackgres.

> ATTN: DO NOT USE BOTH CRDS (`SGCluster` and `SGShardedCluster`) UNDER ANY CIRCUMSTANCES!!!

